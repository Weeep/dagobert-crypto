import type { MarketInterval } from "../domain/Candle";
import { isMarketInterval, MARKET_INTERVAL_MILLISECONDS } from "../domain/Candle";
import type { CandleRepository } from "../domain/CandleRepository";
import type { CandleIngestionCursorRepository } from "../domain/CandleIngestionCursor";
import type { MarketDataLease } from "../domain/MarketDataLease";
import type { MarketDataSource } from "../domain/MarketDataSource";
import { BackfillCandlesUseCase } from "./BackfillCandlesUseCase";
import { SaveCandlesUseCase } from "./SaveCandlesUseCase";

export type PollClosedCandlesInput = {
  pairSymbol: string;
  interval: MarketInterval;
  maxCandles?: number;
  signal?: AbortSignal;
};

export type PollClosedCandlesResult = {
  status: "completed" | "skipped";
  source: "BINANCE";
  pairSymbol: string;
  interval: MarketInterval;
  range: { from: Date; to: Date } | null;
  previousCursor: Date | null;
  lastClosedOpenTime: Date | null;
  expectedLastClosedOpenTime: Date | null;
  cursorLagMs: number | null;
  health: "healthy" | "unhealthy";
  reasons: PollHealthReason[];
  candlesFetched: number;
  candlesSaved: number;
  missingCandlesDetected: number;
  repairedCandles: number;
  missingCandlesRemaining: number;
  cursorAdvanced: boolean;
  hasMoreWork: boolean;
  clockOffsetMs: bigint | null;
  skipReason?: "lease-unavailable" | "no-closed-range";
};

export type PollHealthReason = "cursor-unavailable" | "cursor-stale" | "clock-drift" |
  "lease-unavailable";

export type PollClosedCandlesOptions = {
  maxCursorLagIntervals?: number;
  maxClockOffsetMs?: number;
};

const SOURCE = "BINANCE" as const;

export class PollClosedCandlesUseCase {
  private readonly saveCandles: SaveCandlesUseCase;
  private readonly backfill: BackfillCandlesUseCase;

  constructor(
    repository: CandleRepository,
    private readonly cursorRepository: CandleIngestionCursorRepository,
    private readonly source: MarketDataSource,
    private readonly lease: MarketDataLease,
    private readonly now: () => Date = () => new Date(),
    private readonly options: PollClosedCandlesOptions = {},
  ) {
    this.saveCandles = new SaveCandlesUseCase(repository);
    this.backfill = new BackfillCandlesUseCase(repository, cursorRepository, source, now);
  }

  async execute(input: PollClosedCandlesInput): Promise<PollClosedCandlesResult> {
    const pairSymbol = input.pairSymbol.trim().toUpperCase();
    if (!/^[A-Z0-9]+USDC$/.test(pairSymbol)) throw new Error("pairSymbol must be an uppercase USDC pair");
    if (!isMarketInterval(input.interval)) throw new Error("interval is not supported");
    const maxCandles = input.maxCandles ?? 1_000;
    if (!Number.isInteger(maxCandles) || maxCandles < 2 || maxCandles > 1_000)
      throw new Error("maxCandles must be an integer between 2 and 1000");
    const key = { source: SOURCE, pairSymbol, interval: input.interval };
    const result = await this.lease.withLease(key, () => this.poll(key, maxCandles, input.signal));
    return result ?? {
      status: "skipped", source: SOURCE, pairSymbol, interval: input.interval, range: null,
      previousCursor: null, lastClosedOpenTime: null, candlesFetched: 0, candlesSaved: 0,
      expectedLastClosedOpenTime: null, cursorLagMs: null, health: "unhealthy",
      reasons: ["lease-unavailable"], missingCandlesDetected: 0, repairedCandles: 0,
      missingCandlesRemaining: 0,
      cursorAdvanced: false, hasMoreWork: false, clockOffsetMs: null, skipReason: "lease-unavailable",
    };
  }

  private async poll(key: { source: typeof SOURCE; pairSymbol: string; interval: MarketInterval },
    maxCandles: number, signal?: AbortSignal): Promise<PollClosedCandlesResult> {
    const cursor = await this.cursorRepository.find(key);
    try {
      const clock = await this.source.fetchServerTime(signal);
      const intervalMs = MARKET_INTERVAL_MILLISECONDS[key.interval];
      const effectiveEndMs = Math.floor(clock.serverTime.getTime() / intervalMs) * intervalMs;
      const expectedLastClosedOpenTime = new Date(effectiveEndMs - intervalMs);
      const fromMs = cursor?.lastClosedOpenTime
        ? cursor.lastClosedOpenTime.getTime() - intervalMs
        : effectiveEndMs - intervalMs;
      if (fromMs >= effectiveEndMs) return {
        status: "skipped", source: SOURCE, pairSymbol: key.pairSymbol, interval: key.interval, range: null,
        previousCursor: cursor?.lastClosedOpenTime ?? null, lastClosedOpenTime: cursor?.lastClosedOpenTime ?? null,
        expectedLastClosedOpenTime,
        ...this.health(cursor?.lastClosedOpenTime ?? null, expectedLastClosedOpenTime,
          clock.clockOffsetMs, intervalMs),
        candlesFetched: 0, candlesSaved: 0, cursorAdvanced: false, hasMoreWork: false,
        missingCandlesDetected: 0, repairedCandles: 0, missingCandlesRemaining: 0,
        clockOffsetMs: clock.clockOffsetMs,
        skipReason: "no-closed-range",
      };
      const from = new Date(fromMs);
      // Recover a stale cursor one Binance page at a time. The next worker tick
      // resumes from the advanced cursor instead of holding an unbounded batch
      // in memory and writing thousands of rows in one transaction.
      const boundedEndMs = Math.min(effectiveEndMs, fromMs + (maxCandles * intervalMs));
      const to = new Date(boundedEndMs);
      const batch = await this.source.fetchHistoricalCandles({
        pairSymbol: key.pairSymbol, interval: key.interval, from, to, signal,
      });
      const saved = await this.saveCandles.execute(batch.candles);
      if (!saved.ok) throw new Error(`Cannot persist polled candles: ${saved.error}`);
      const repaired = await this.backfill.execute({
        pairSymbol: key.pairSymbol,
        interval: key.interval,
        start: from,
        end: to,
        pageSize: maxCandles,
        maxPages: 1,
        signal,
      });
      return {
        status: "completed", source: SOURCE, pairSymbol: key.pairSymbol, interval: key.interval,
        range: { from, to }, previousCursor: cursor?.lastClosedOpenTime ?? null,
        lastClosedOpenTime: repaired.lastContiguousOpenTime,
        expectedLastClosedOpenTime,
        ...this.health(repaired.lastContiguousOpenTime, expectedLastClosedOpenTime,
          batch.clockOffsetMs, intervalMs),
        candlesFetched: batch.candles.length + repaired.candlesFetched,
        candlesSaved: saved.saved + repaired.candlesSaved,
        missingCandlesDetected: repaired.missingCandlesDetected,
        repairedCandles: repaired.repairedCandles,
        missingCandlesRemaining: repaired.missingCandlesRemaining,
        cursorAdvanced: repaired.cursorAdvanced,
        hasMoreWork: boundedEndMs < effectiveEndMs || repaired.hasMoreWork,
        clockOffsetMs: batch.clockOffsetMs,
      };
    } catch (error) {
      await this.cursorRepository.recordError(key, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private health(lastClosedOpenTime: Date | null, expectedLastClosedOpenTime: Date,
    clockOffsetMs: bigint, intervalMs: number) {
    const cursorLagMs = lastClosedOpenTime === null ? null :
      Math.max(0, expectedLastClosedOpenTime.getTime() - lastClosedOpenTime.getTime());
    const reasons: PollHealthReason[] = [];
    if (cursorLagMs === null) reasons.push("cursor-unavailable");
    else if (cursorLagMs > (this.options.maxCursorLagIntervals ?? 1) * intervalMs)
      reasons.push("cursor-stale");
    if (clockOffsetMs > BigInt(this.options.maxClockOffsetMs ?? 5_000) ||
      clockOffsetMs < BigInt(-(this.options.maxClockOffsetMs ?? 5_000))) reasons.push("clock-drift");
    return { cursorLagMs, health: reasons.length === 0 ? "healthy" as const : "unhealthy" as const, reasons };
  }
}
