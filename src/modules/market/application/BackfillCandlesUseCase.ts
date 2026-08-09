import type { MarketInterval } from "../domain/Candle";
import { isMarketInterval, MARKET_INTERVAL_MILLISECONDS } from "../domain/Candle";
import type { CandleRepository } from "../domain/CandleRepository";
import type { CandleIngestionCursorRepository } from "../domain/CandleIngestionCursor";
import type { MarketDataSource } from "../domain/MarketDataSource";
import { defaultBackfillStart } from "@/src/shared/domain/HistoricalBackfillPolicy";
import { SaveCandlesUseCase } from "./SaveCandlesUseCase";

export type CandleGap = {
  start: Date;
  end: Date;
  expectedCandles: number;
};

export type BackfillCandlesInput = {
  pairSymbol: string;
  interval: MarketInterval;
  start?: Date;
  end?: Date;
  pageSize?: number;
  maxPages?: number;
  dryRun?: boolean;
  signal?: AbortSignal;
  onProgress?: (event: BackfillProgressEvent) => void | Promise<void>;
};

export type BackfillProgressEvent =
  | { type: "page-saved"; page: number; range: { start: Date; end: Date }; fetched: number; saved: number }
  | { type: "verifying"; range: { start: Date; end: Date } }
  | { type: "completed"; status: BackfillCandlesResult["status"]; pagesFetched: number; candlesSaved: number };

export type BackfillCandlesResult = {
  status: "completed" | "partial" | "dry-run";
  source: "BINANCE";
  pairSymbol: string;
  interval: MarketInterval;
  requestedRange: { start: Date; end: Date };
  effectiveEnd: Date;
  dryRun: boolean;
  expectedCandles: number;
  existingCandles: number;
  missingCandlesDetected: number;
  missingRanges: CandleGap[];
  pagesFetched: number;
  candlesFetched: number;
  candlesSaved: number;
  remainingMissingRanges: CandleGap[];
  lastContiguousOpenTime: Date | null;
  cursorAdvanced: boolean;
  hasMoreWork: boolean;
  resumeFrom: Date | null;
};

const SOURCE = "BINANCE" as const;
// Empty exchange pages do not consume the persistence-page budget: a recently
// listed symbol may have no rows for years of the configured default range.
// This separate ceiling keeps even pathological explicit ranges bounded.
const MAX_EMPTY_PAGES_PER_INVOCATION = 10_000;

export class BackfillCandlesUseCase {
  private readonly saveCandles: SaveCandlesUseCase;

  constructor(
    private readonly repository: CandleRepository,
    private readonly cursorRepository: CandleIngestionCursorRepository,
    private readonly source: MarketDataSource,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.saveCandles = new SaveCandlesUseCase(repository);
  }

  async execute(input: BackfillCandlesInput): Promise<BackfillCandlesResult> {
    const normalized = this.normalizeInput(input);
    const { pairSymbol, interval, start, end, effectiveEnd, pageSize, maxPages, dryRun } = normalized;
    const intervalMs = MARKET_INTERVAL_MILLISECONDS[interval];
    const before = await this.repository.findRange(pairSymbol, interval, start,
      new Date(Math.max(start.getTime(), effectiveEnd.getTime() - 1)));
    const missingRanges = this.findGaps(start, effectiveEnd, interval, before.map(({ openTime }) => openTime));
    const missingCandlesDetected = missingRanges.reduce((total, gap) => total + gap.expectedCandles, 0);

    let pagesFetched = 0;
    let nonEmptyPagesFetched = 0;
    let emptyPagesFetched = 0;
    let candlesFetched = 0;
    let candlesSaved = 0;
    if (!dryRun) {
      for (const gap of missingRanges) {
        for (let pageStartMs = gap.start.getTime(); pageStartMs < gap.end.getTime();) {
          if (nonEmptyPagesFetched >= maxPages || emptyPagesFetched >= MAX_EMPTY_PAGES_PER_INVOCATION) break;
          if (input.signal?.aborted) throw this.abortError();
          const pageEndMs = Math.min(gap.end.getTime(), pageStartMs + (pageSize * intervalMs));
          const batch = await this.source.fetchHistoricalCandles({
            pairSymbol,
            interval,
            from: new Date(pageStartMs),
            to: new Date(pageEndMs),
            pageSize,
            signal: input.signal,
          });
          pagesFetched += 1;
          candlesFetched += batch.candles.length;
          if (batch.candles.length === 0) emptyPagesFetched += 1;
          else nonEmptyPagesFetched += 1;
          const saved = await this.saveCandles.execute(batch.candles);
          if (!saved.ok) throw new Error(`Cannot persist historical candles: ${saved.error}`);
          candlesSaved += saved.saved;
          await input.onProgress?.({
            type: "page-saved",
            page: pagesFetched,
            range: { start: new Date(pageStartMs), end: new Date(pageEndMs) },
            fetched: batch.candles.length,
            saved: saved.saved,
          });
          pageStartMs = pageEndMs;
        }
        if (nonEmptyPagesFetched >= maxPages || emptyPagesFetched >= MAX_EMPTY_PAGES_PER_INVOCATION) break;
      }
    }

    const after = dryRun ? before : await this.repository.findRange(pairSymbol, interval, start,
      new Date(Math.max(start.getTime(), effectiveEnd.getTime() - 1)));
    const remainingMissingRanges = this.findGaps(start, effectiveEnd, interval,
      after.map(({ openTime }) => openTime));
    const firstGapStart = remainingMissingRanges[0]?.start.getTime() ?? effectiveEnd.getTime();
    const lastContiguousOpenTime = firstGapStart > start.getTime()
      ? new Date(firstGapStart - intervalMs)
      : null;
    let cursorAdvanced = false;

    if (!dryRun && lastContiguousOpenTime) {
      const currentCursor = await this.cursorRepository.find({ source: SOURCE, pairSymbol, interval });
      const cursorTime = currentCursor?.lastClosedOpenTime?.getTime();
      const cursorCanReachRange = cursorTime === undefined || cursorTime + intervalMs >= start.getTime();
      if (cursorCanReachRange && (cursorTime === undefined || cursorTime < lastContiguousOpenTime.getTime())) {
        const clock = await this.source.fetchServerTime(input.signal);
        await input.onProgress?.({ type: "verifying", range: { start, end: lastContiguousOpenTime } });
        await this.cursorRepository.advanceAfterVerifiedRange({
          source: SOURCE,
          pairSymbol,
          interval,
          lastClosedOpenTime: lastContiguousOpenTime,
          lastSuccessfulPollAt: this.now(),
          clockOffsetMs: clock.clockOffsetMs,
        }, start);
        cursorAdvanced = true;
      }
    }

    const hasMoreWork = remainingMissingRanges.length > 0;
    const result: BackfillCandlesResult = {
      status: dryRun ? "dry-run" : hasMoreWork ? "partial" : "completed",
      source: SOURCE,
      pairSymbol,
      interval,
      requestedRange: { start, end },
      effectiveEnd,
      dryRun,
      expectedCandles: Math.max(0, (effectiveEnd.getTime() - start.getTime()) / intervalMs),
      existingCandles: before.length,
      missingCandlesDetected,
      missingRanges,
      pagesFetched,
      candlesFetched,
      candlesSaved,
      remainingMissingRanges,
      lastContiguousOpenTime,
      cursorAdvanced,
      hasMoreWork,
      resumeFrom: remainingMissingRanges[0]?.start ?? null,
    };
    await input.onProgress?.({ type: "completed", status: result.status, pagesFetched, candlesSaved });
    return result;
  }

  findGaps(start: Date, end: Date, interval: MarketInterval, persistedOpenTimes: Date[]): CandleGap[] {
    const intervalMs = MARKET_INTERVAL_MILLISECONDS[interval];
    const persisted = new Set(persistedOpenTimes.map((value) => value.getTime()));
    const gaps: CandleGap[] = [];
    let gapStart: number | null = null;
    for (let expected = start.getTime(); expected < end.getTime(); expected += intervalMs) {
      if (!persisted.has(expected) && gapStart === null) gapStart = expected;
      if (persisted.has(expected) && gapStart !== null) {
        gaps.push(this.gap(gapStart, expected, intervalMs));
        gapStart = null;
      }
    }
    if (gapStart !== null) gaps.push(this.gap(gapStart, end.getTime(), intervalMs));
    return gaps;
  }

  private normalizeInput(input: BackfillCandlesInput) {
    const pairSymbol = input.pairSymbol.trim().toUpperCase();
    if (!/^[A-Z0-9]+USDC$/.test(pairSymbol))
      throw new Error("pairSymbol must be an uppercase USDC pair");
    if (!isMarketInterval(input.interval)) throw new Error("interval is not supported");
    const interval = input.interval;
    const intervalMs = MARKET_INTERVAL_MILLISECONDS[interval];
    const start = input.start ? new Date(input.start) : defaultBackfillStart(interval);
    const end = input.end ? new Date(input.end) : this.now();
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end)
      throw new Error("Historical backfill range is invalid");
    if (start.getTime() % intervalMs !== 0)
      throw new Error("Historical backfill start must align to an interval boundary");
    const effectiveEnd = new Date(Math.floor(end.getTime() / intervalMs) * intervalMs);
    if (effectiveEnd <= start) throw new Error("Historical backfill range contains no closed interval");
    const pageSize = input.pageSize ?? 1_000;
    const maxPages = input.maxPages ?? 10;
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1_000)
      throw new Error("pageSize must be an integer between 1 and 1000");
    if (!Number.isInteger(maxPages) || maxPages < 1)
      throw new Error("maxPages must be a positive integer");
    return { pairSymbol, interval, start, end, effectiveEnd, pageSize, maxPages, dryRun: input.dryRun ?? false };
  }

  private gap(start: number, end: number, intervalMs: number): CandleGap {
    return { start: new Date(start), end: new Date(end), expectedCandles: (end - start) / intervalMs };
  }

  private abortError(): Error {
    const error = new Error("Historical backfill was aborted");
    error.name = "AbortError";
    return error;
  }
}
