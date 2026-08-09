import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { describe } from "node:test";
import type {
  Candle,
  CandleIngestionCheckpoint,
  CandleIngestionCursor,
  CandleIngestionKey,
  CandleRepository,
  HistoricalCandleRequest,
  MarketDataSource,
} from "@/src/modules/market";
import { BackfillCandlesUseCase } from "@/src/modules/market";
import {
  DEFAULT_BACKFILL_CANDLE_COUNT,
  defaultBackfillStart,
} from "@/src/shared/domain/HistoricalBackfillPolicy";

const hour = 3_600_000;
const start = Date.parse("2026-08-01T00:00:00.000Z");

function candle(openTime: number, pairSymbol = "BTCUSDC", interval: "1h" | "1d" = "1h"): Candle {
  const intervalMilliseconds = interval === "1d" ? 24 * hour : hour;
  return {
    id: randomUUID(), pairSymbol, interval, openTime: new Date(openTime),
    closeTime: new Date(openTime + intervalMilliseconds - 1), open: "100", high: "110", low: "90", close: "105",
    volume: "10", quoteVolume: "1000", trades: 20, isClosed: true, source: "BINANCE",
    receivedAt: new Date(openTime + hour),
  };
}

class MemoryCandleRepository implements CandleRepository {
  readonly candles = new Map<number, Candle>();
  readonly saveBatchSizes: number[] = [];
  cursor: CandleIngestionCursor | null = null;
  findById(id: string) {
    return Promise.resolve(Array.from(this.candles.values()).find((value) => value.id === id) ?? null);
  }
  findRange(_pairSymbol: string, _interval: string, from: Date, to: Date) {
    return Promise.resolve(Array.from(this.candles.values())
      .filter((value) => value.openTime >= from && value.openTime <= to)
      .sort((left, right) => left.openTime.getTime() - right.openTime.getTime()));
  }
  saveMany(candles: Candle[], checkpoint?: CandleIngestionCheckpoint) {
    this.saveBatchSizes.push(candles.length);
    for (const value of candles) this.candles.set(value.openTime.getTime(), value);
    if (checkpoint) this.cursor = {
      id: randomUUID(), ...checkpoint, status: "HEALTHY", lastError: null,
      createdAt: new Date(), updatedAt: new Date(),
    };
    return Promise.resolve();
  }
  find(_key: CandleIngestionKey) { return Promise.resolve(this.cursor); }
  recordError() { return Promise.resolve(); }
  advanceAfterVerifiedRange(checkpoint: CandleIngestionCheckpoint, contiguousFrom: Date) {
    const interval = checkpoint.interval === "1d" ? 24 * hour : hour;
    for (let expected = contiguousFrom.getTime();
      expected <= checkpoint.lastClosedOpenTime.getTime(); expected += interval) {
      if (!this.candles.has(expected)) return Promise.reject(new Error("missing interval"));
    }
    this.cursor = {
      id: randomUUID(), ...checkpoint, status: "HEALTHY", lastError: null,
      createdAt: new Date(), updatedAt: new Date(),
    };
    return Promise.resolve();
  }
}

class FixtureMarketDataSource implements MarketDataSource {
  readonly requests: HistoricalCandleRequest[] = [];
  constructor(private readonly available: Candle[]) {}
  fetchServerTime() {
    return Promise.resolve({ serverTime: new Date(start + (10 * hour)), clockOffsetMs: BigInt(25) });
  }
  fetchHistoricalCandles(request: HistoricalCandleRequest) {
    this.requests.push(request);
    return Promise.resolve({
      candles: this.available.filter((value) =>
        value.openTime >= request.from && value.openTime < request.to),
      serverTime: new Date(start + (10 * hour)),
      clockOffsetMs: BigInt(25),
    });
  }
}

describe("historical candle backfill and gap repair", () => {
  test("derives a rolling fifteen-thousand-candle range and defaults end to now", async () => {
    assert.equal(DEFAULT_BACKFILL_CANDLE_COUNT, 15_000);
    const repository = new MemoryCandleRepository();
    const now = new Date("2026-08-09T02:34:56.000Z");
    const result = await new BackfillCandlesUseCase(repository, repository,
      new FixtureMarketDataSource([]), () => now).execute({
      pairSymbol: "BTCUSDC", interval: "1h", dryRun: true,
    });
    assert.equal(result.requestedRange.start.toISOString(), defaultBackfillStart("1h", now).toISOString());
    assert.equal(result.requestedRange.end, now);
    assert.equal(result.effectiveEnd.toISOString(), "2026-08-09T02:00:00.000Z");
    assert.equal(result.expectedCandles, 15_000);
    assert.equal(result.missingCandlesDetected, 15_000);
    for (const interval of ["15m", "1h", "4h", "1d"] as const) {
      const intervalMs = { "15m": 900_000, "1h": hour, "4h": 4 * hour, "1d": 24 * hour }[interval];
      assert.equal((Math.floor(now.getTime() / intervalMs) * intervalMs -
        defaultBackfillStart(interval, now).getTime()) / intervalMs, 15_000);
    }
  });

  test("caps the default invocation at exactly fifteen thousand candles", async () => {
    const repository = new MemoryCandleRepository();
    const available = Array.from({ length: 15_001 }, (_value, index) => candle(start + (index * hour)));
    const result = await new BackfillCandlesUseCase(repository, repository,
      new FixtureMarketDataSource(available)).execute({
      pairSymbol: "BTCUSDC",
      interval: "1h",
      start: new Date(start),
      end: new Date(start + (15_001 * hour)),
      pageSize: 700,
    });

    assert.equal(result.candlesFetched, 15_000);
    assert.equal(result.candlesSaved, 15_000);
    assert.equal(result.status, "partial");
    assert.equal(result.resumeFrom?.getTime(), start + (15_000 * hour));
    assert.equal(Math.max(...repository.saveBatchSizes), 700);
    assert.equal(repository.saveBatchSizes.at(-1), 300);
  });

  test("treats the leading default range before a symbol listing as unavailable, not missing", async () => {
    const day = 24 * hour;
    const end = new Date("2026-08-10T12:34:56.000Z");
    const alignedEnd = Math.floor(end.getTime() / day) * day;
    const repository = new MemoryCandleRepository();
    const source = new FixtureMarketDataSource([
      candle(alignedEnd - (2 * day), "SOLUSDC", "1d"),
      candle(alignedEnd - day, "SOLUSDC", "1d"),
    ]);
    const result = await new BackfillCandlesUseCase(repository, repository, source, () => end).execute({
      pairSymbol: "SOLUSDC",
      interval: "1d",
    });

    assert.equal(result.status, "completed");
    assert.equal(result.expectedCandles, 15_000);
    assert.equal(result.candlesSaved, 2);
    assert.equal(result.repairedCandles, 2);
    assert.equal(result.missingCandlesRemaining, 0);
    assert.equal(result.unavailableLeadingRange?.expectedCandles, 14_998);
    assert.deepEqual(result.remainingMissingRanges, []);
  });

  test("reports every contiguous gap without writing during dry-run", async () => {
    const repository = new MemoryCandleRepository();
    for (const offset of [0, 3, 4, 7]) repository.candles.set(start + (offset * hour), candle(start + (offset * hour)));
    const source = new FixtureMarketDataSource([]);
    const result = await new BackfillCandlesUseCase(repository, repository, source).execute({
      pairSymbol: "BTCUSDC", interval: "1h", start: new Date(start), end: new Date(start + (8 * hour)),
      dryRun: true,
    });
    assert.deepEqual(result.missingRanges.map((gap) => [gap.start.getTime(), gap.end.getTime()]), [
      [start + hour, start + (3 * hour)],
      [start + (5 * hour), start + (7 * hour)],
    ]);
    assert.equal(result.missingCandlesDetected, 4);
    assert.equal(result.candlesSaved, 0);
    assert.equal(source.requests.length, 0);
    assert.equal(repository.cursor, null);
  });

  test("bounds work, resumes a multi-page import, is idempotent, and repairs a deletion", async () => {
    const repository = new MemoryCandleRepository();
    const available = Array.from({ length: 6 }, (_value, index) => candle(start + (index * hour)));
    const source = new FixtureMarketDataSource(available);
    const useCase = new BackfillCandlesUseCase(repository, repository, source,
      () => new Date(start + (7 * hour)));
    const progress: string[] = [];
    const input = {
      pairSymbol: "BTCUSDC", interval: "1h" as const, start: new Date(start),
      end: new Date(start + (6 * hour)), pageSize: 2, maxPages: 1,
    };

    const interrupted = await useCase.execute({ ...input,
      onProgress: (event) => { progress.push(event.type); } });
    assert.equal(interrupted.status, "partial");
    assert.equal(interrupted.candlesSaved, 2);
    assert.equal(interrupted.resumeFrom?.getTime(), start + (2 * hour));
    assert.equal(repository.cursor?.lastClosedOpenTime?.getTime(), start + hour);
    assert.deepEqual(repository.saveBatchSizes, [2]);
    assert.deepEqual(progress, ["page-saved", "verifying", "completed"]);

    await useCase.execute(input);
    const completed = await useCase.execute({ ...input, maxPages: 1 });
    assert.equal(completed.status, "completed");
    assert.equal(repository.candles.size, 6);
    assert.equal(repository.cursor?.lastClosedOpenTime?.getTime(), start + (5 * hour));
    assert.equal(Math.max(...repository.saveBatchSizes), 2);

    const rerun = await useCase.execute(input);
    assert.equal(rerun.candlesFetched, 0);
    assert.equal(rerun.candlesSaved, 0);
    assert.equal(repository.candles.size, 6);

    repository.candles.delete(start + (3 * hour));
    const repaired = await useCase.execute(input);
    assert.deepEqual(repaired.missingRanges.map((gap) => gap.start.getTime()), [start + (3 * hour)]);
    assert.equal(repaired.remainingMissingRanges.length, 0);
    assert.equal(repository.candles.size, 6);
  });

  test("scans past empty pre-listing pages before applying the non-empty page limit", async () => {
    const repository = new MemoryCandleRepository();
    const source = new FixtureMarketDataSource([
      candle(start + (4 * hour), "SOLUSDC"),
      candle(start + (5 * hour), "SOLUSDC"),
    ]);
    const result = await new BackfillCandlesUseCase(repository, repository, source).execute({
      pairSymbol: "SOLUSDC",
      interval: "1h",
      start: new Date(start),
      end: new Date(start + (6 * hour)),
      pageSize: 2,
      maxPages: 1,
    });

    assert.deepEqual(source.requests.map((request) => request.from.getTime()), [
      start,
      start + (2 * hour),
      start + (4 * hour),
    ]);
    assert.equal(result.pagesFetched, 3);
    assert.equal(result.candlesFetched, 2);
    assert.equal(repository.candles.size, 2);
  });

  test("checkpoints fifteen thousand existing candles without re-upserting their history", async () => {
    const repository = new MemoryCandleRepository();
    for (let index = 0; index < 15_000; index += 1)
      repository.candles.set(start + (index * hour), candle(start + (index * hour)));
    const useCase = new BackfillCandlesUseCase(repository, repository, new FixtureMarketDataSource([]),
      () => new Date(start + (15_001 * hour)));

    const result = await useCase.execute({
      pairSymbol: "BTCUSDC",
      interval: "1h",
      start: new Date(start),
      end: new Date(start + (15_000 * hour)),
    });

    assert.equal(result.status, "completed");
    assert.equal(repository.cursor?.lastClosedOpenTime?.getTime(), start + (14_999 * hour));
    assert.deepEqual(repository.saveBatchSizes, []);
  });

  test("supports explicit overrides and rejects invalid boundaries and limits", async () => {
    const repository = new MemoryCandleRepository();
    const useCase = new BackfillCandlesUseCase(repository, repository, new FixtureMarketDataSource([]));
    await assert.rejects(() => useCase.execute({ pairSymbol: "BTCUSDC", interval: "1h",
      start: new Date(start + 1), end: new Date(start + hour) }), /align/);
    await assert.rejects(() => useCase.execute({ pairSymbol: "BTCUSDC", interval: "1h",
      start: new Date(start), end: new Date(start + hour), pageSize: 1001 }), /pageSize/);
    await assert.rejects(() => useCase.execute({ pairSymbol: "BTCUSDC", interval: "1h",
      start: new Date(start), end: new Date(start + hour), maxPages: 0 }), /maxPages/);
  });
});
