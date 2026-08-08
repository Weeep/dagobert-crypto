import { randomUUID } from "node:crypto";
import type { Binance, CandleChartResult, CandlesOptions } from "binance-api-node";
import type { Candle } from "../../domain/Candle";
import { MARKET_INTERVAL_MILLISECONDS } from "../../domain/Candle";
import type { HistoricalCandleBatch, HistoricalCandleRequest,
  MarketDataSource } from "../../domain/MarketDataSource";
import { validateCandle } from "../../domain/CandleValidation";

export type BinanceRestMarketDataSourceOptions = {
  maxRetries?: number;
  requestTimeoutMs?: number;
  retryBaseDelayMs?: number;
  now?: () => number;
  sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  random?: () => number;
};

function abortError(): Error {
  const error = new Error("Market-data request was aborted");
  error.name = "AbortError";
  return error;
}

function defaultSleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(abortError());
    }, { once: true });
  });
}

function statusOf(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const value = error as { status?: unknown; statusCode?: unknown; response?: { status?: unknown } };
  const status = value.status ?? value.statusCode ?? value.response?.status;
  return typeof status === "number" ? status : undefined;
}

function isRetryable(error: unknown): boolean {
  const status = statusOf(error);
  if (status === 408 || status === 429 || (status !== undefined && status >= 500)) return true;
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ENOTFOUND"].includes(code);
}

export class BinanceRestMarketDataSource implements MarketDataSource {
  private readonly maxRetries: number;
  private readonly requestTimeoutMs: number;
  private readonly retryBaseDelayMs: number;
  private readonly now: () => number;
  private readonly sleep: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  private readonly random: () => number;

  constructor(private readonly client: Pick<Binance, "time" | "candles">,
    options: BinanceRestMarketDataSourceOptions = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 10_000;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 250;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? defaultSleep;
    this.random = options.random ?? Math.random;
  }

  async fetchServerTime(signal?: AbortSignal) {
    const measurement = await this.withRetry(async () => {
      const requestedAt = this.now();
      const serverTimeMs = await this.client.time();
      if (!Number.isSafeInteger(serverTimeMs) || serverTimeMs <= 0)
        throw new Error("Binance returned an invalid server time");
      return { requestedAt, serverTimeMs, receivedAt: this.now() };
    }, signal);
    const { requestedAt, serverTimeMs, receivedAt } = measurement;
    const localMidpoint = Math.trunc(requestedAt + ((receivedAt - requestedAt) / 2));
    return {
      serverTime: new Date(serverTimeMs),
      clockOffsetMs: BigInt(serverTimeMs - localMidpoint),
    };
  }

  async fetchHistoricalCandles(request: HistoricalCandleRequest): Promise<HistoricalCandleBatch> {
    this.validateRequest(request);
    const clock = await this.fetchServerTime(request.signal);
    const pageSize = request.pageSize ?? 1_000;
    const intervalMs = MARKET_INTERVAL_MILLISECONDS[request.interval];
    const candles: Candle[] = [];
    let nextOpenTime = request.from.getTime();
    let previousOpenTime: number | null = null;

    while (nextOpenTime < request.to.getTime()) {
      if (request.signal?.aborted) throw abortError();
      const options: CandlesOptions = {
        symbol: request.pairSymbol,
        interval: request.interval,
        limit: pageSize,
        startTime: nextOpenTime,
        endTime: request.to.getTime() - 1,
      };
      const rows = await this.withRetry(() => this.client.candles(options), request.signal);
      if (!Array.isArray(rows)) throw new Error("Binance returned a malformed candle page");
      if (rows.length === 0) break;

      for (const row of rows) {
        this.validateOrder(row, previousOpenTime, nextOpenTime, request.to.getTime());
        previousOpenTime = row.openTime;
        const isClosed = row.closeTime <= clock.serverTime.getTime();
        const candle = this.mapCandle(row, request, isClosed);
        validateCandle(candle);
        if (isClosed) candles.push(candle);
      }

      const last = rows.at(-1);
      if (!last || !Number.isSafeInteger(last.openTime))
        throw new Error("Binance returned a malformed candle page boundary");
      const advancedOpenTime = last.openTime + intervalMs;
      if (advancedOpenTime <= nextOpenTime)
        throw new Error("Binance candle pagination did not advance");
      nextOpenTime = advancedOpenTime;
      if (rows.length < pageSize) break;
    }

    return { candles, ...clock };
  }

  private mapCandle(row: CandleChartResult, request: HistoricalCandleRequest, isClosed: boolean): Candle {
    return {
      id: randomUUID(),
      pairSymbol: request.pairSymbol,
      interval: request.interval,
      openTime: new Date(row.openTime),
      closeTime: new Date(row.closeTime),
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
      quoteVolume: row.quoteVolume,
      trades: row.trades,
      isClosed,
      source: "BINANCE",
      receivedAt: new Date(this.now()),
    };
  }

  private validateRequest(request: HistoricalCandleRequest) {
    if (!/^[A-Z0-9]+USDC$/.test(request.pairSymbol))
      throw new Error("pairSymbol must be an uppercase USDC pair");
    if (!Number.isFinite(request.from.getTime()) || !Number.isFinite(request.to.getTime()) ||
      request.from >= request.to) throw new Error("Historical candle range is invalid");
    if (request.pageSize !== undefined &&
      (!Number.isInteger(request.pageSize) || request.pageSize < 1 || request.pageSize > 1_000))
      throw new Error("pageSize must be an integer between 1 and 1000");
  }

  private validateOrder(row: CandleChartResult, previousOpenTime: number | null,
    pageStart: number, exclusiveEnd: number) {
    if (!row || !Number.isSafeInteger(row.openTime) || !Number.isSafeInteger(row.closeTime) ||
      row.openTime < pageStart || row.openTime >= exclusiveEnd)
      throw new Error("Binance returned a candle outside the requested page");
    if (previousOpenTime !== null && row.openTime <= previousOpenTime)
      throw new Error("Binance returned duplicated or out-of-order candles");
  }

  private async withRetry<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      if (signal?.aborted) throw abortError();
      try {
        return await this.withTimeout(operation(), signal);
      } catch (error) {
        if (signal?.aborted) throw abortError();
        if (attempt >= this.maxRetries || !isRetryable(error)) throw error;
        const exponentialDelay = this.retryBaseDelayMs * (2 ** attempt);
        const jitteredDelay = Math.trunc(exponentialDelay * (0.5 + this.random()));
        await this.sleep(jitteredDelay, signal);
      }
    }
  }

  private async withTimeout<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abortListener: (() => void) | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error("Binance request timed out"),
        { code: "ETIMEDOUT" })), this.requestTimeoutMs);
      if (signal) {
        abortListener = () => reject(abortError());
        signal.addEventListener("abort", abortListener, { once: true });
      }
    });
    try {
      return await Promise.race([operation, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
      if (signal && abortListener) signal.removeEventListener("abort", abortListener);
    }
  }
}
