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
  DEFAULT_BACKFILL_START_BY_INTERVAL,
  defaultBackfillStart,
} from "@/src/shared/domain/HistoricalBackfillPolicy";

const hour = 3_600_000;
const start = Date.parse("2026-08-01T00:00:00.000Z");

function candle(openTime: number, pairSymbol = "BTCUSDC"): Candle {
  return {
    id: randomUUID(), pairSymbol, interval: "1h", openTime: new Date(openTime),
    closeTime: new Date(openTime + hour - 1), open: "100", high: "110", low: "90", close: "105",
    volume: "10", quoteVolume: "1000", trades: 20, isClosed: true, source: "BINANCE",
    receivedAt: new Date(openTime + hour),
  };
}

class MemoryCandleRepository implements CandleRepository {
  readonly candles = new Map<number, Candle>();
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
    for (const value of candles) this.candles.set(value.openTime.getTime(), value);
    if (checkpoint) this.cursor = {
      id: randomUUID(), ...checkpoint, status: "HEALTHY", lastError: null,
      createdAt: new Date(), updatedAt: new Date(),
    };
    return Promise.resolve();
  }
  find(_key: CandleIngestionKey) { return Promise.resolve(this.cursor); }
  recordError() { return Promise.resolve(); }
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
  test("keeps default starts in one policy and defaults end to now", async () => {
    assert.deepEqual(DEFAULT_BACKFILL_START_BY_INTERVAL, {
      "15m": "2025-01-01T00:00:00.000Z",
      "1h": "2025-01-01T00:00:00.000Z",
      "4h": "2023-01-01T00:00:00.000Z",
      "1d": "2018-01-01T00:00:00.000Z",
    });
    const repository = new MemoryCandleRepository();
    const now = new Date("2025-01-01T02:34:56.000Z");
    const result = await new BackfillCandlesUseCase(repository, repository,
      new FixtureMarketDataSource([]), () => now).execute({
      pairSymbol: "BTCUSDC", interval: "1h", dryRun: true,
    });
    assert.equal(result.requestedRange.start.toISOString(), defaultBackfillStart("1h").toISOString());
    assert.equal(result.requestedRange.end, now);
    assert.equal(result.effectiveEnd.toISOString(), "2025-01-01T02:00:00.000Z");
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
    const input = {
      pairSymbol: "BTCUSDC", interval: "1h" as const, start: new Date(start),
      end: new Date(start + (6 * hour)), pageSize: 2, maxPages: 1,
    };

    const interrupted = await useCase.execute(input);
    assert.equal(interrupted.status, "partial");
    assert.equal(interrupted.candlesSaved, 2);
    assert.equal(interrupted.resumeFrom?.getTime(), start + (2 * hour));
    assert.equal(repository.cursor?.lastClosedOpenTime?.getTime(), start + hour);

    await useCase.execute(input);
    const completed = await useCase.execute({ ...input, maxPages: 1 });
    assert.equal(completed.status, "completed");
    assert.equal(repository.candles.size, 6);
    assert.equal(repository.cursor?.lastClosedOpenTime?.getTime(), start + (5 * hour));

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
