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
  candlesFetched: number;
  candlesSaved: number;
  cursorAdvanced: boolean;
  clockOffsetMs: bigint | null;
  skipReason?: "lease-unavailable" | "no-closed-range";
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
  ) {
    this.saveCandles = new SaveCandlesUseCase(repository);
    this.backfill = new BackfillCandlesUseCase(repository, cursorRepository, source, now);
  }

  async execute(input: PollClosedCandlesInput): Promise<PollClosedCandlesResult> {
    const pairSymbol = input.pairSymbol.trim().toUpperCase();
    if (!/^[A-Z0-9]+USDC$/.test(pairSymbol)) throw new Error("pairSymbol must be an uppercase USDC pair");
    if (!isMarketInterval(input.interval)) throw new Error("interval is not supported");
    const key = { source: SOURCE, pairSymbol, interval: input.interval };
    const result = await this.lease.withLease(key, () => this.poll(key, input.signal));
    return result ?? {
      status: "skipped", source: SOURCE, pairSymbol, interval: input.interval, range: null,
      previousCursor: null, lastClosedOpenTime: null, candlesFetched: 0, candlesSaved: 0,
      cursorAdvanced: false, clockOffsetMs: null, skipReason: "lease-unavailable",
    };
  }

  private async poll(key: { source: typeof SOURCE; pairSymbol: string; interval: MarketInterval },
    signal?: AbortSignal): Promise<PollClosedCandlesResult> {
    const cursor = await this.cursorRepository.find(key);
    try {
      const clock = await this.source.fetchServerTime(signal);
      const intervalMs = MARKET_INTERVAL_MILLISECONDS[key.interval];
      const effectiveEndMs = Math.floor(clock.serverTime.getTime() / intervalMs) * intervalMs;
      const fromMs = cursor?.lastClosedOpenTime
        ? cursor.lastClosedOpenTime.getTime() - intervalMs
        : effectiveEndMs - intervalMs;
      if (fromMs >= effectiveEndMs) return {
        status: "skipped", source: SOURCE, pairSymbol: key.pairSymbol, interval: key.interval, range: null,
        previousCursor: cursor?.lastClosedOpenTime ?? null, lastClosedOpenTime: cursor?.lastClosedOpenTime ?? null,
        candlesFetched: 0, candlesSaved: 0, cursorAdvanced: false, clockOffsetMs: clock.clockOffsetMs,
        skipReason: "no-closed-range",
      };
      const from = new Date(fromMs);
      const to = clock.serverTime;
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
        signal,
      });
      return {
        status: "completed", source: SOURCE, pairSymbol: key.pairSymbol, interval: key.interval,
        range: { from, to }, previousCursor: cursor?.lastClosedOpenTime ?? null,
        lastClosedOpenTime: repaired.lastContiguousOpenTime,
        candlesFetched: batch.candles.length + repaired.candlesFetched,
        candlesSaved: saved.saved + repaired.candlesSaved,
        cursorAdvanced: repaired.cursorAdvanced,
        clockOffsetMs: batch.clockOffsetMs,
      };
    } catch (error) {
      await this.cursorRepository.recordError(key, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

