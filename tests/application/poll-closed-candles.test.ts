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
  MarketDataLease,
  MarketDataLeaseKey,
  MarketDataSource,
  MarketDataSubscriptionRepository,
} from "@/src/modules/market";
import {
  DiscoverMarketDataSubscriptionsUseCase,
  MarketDataPollingWorker,
  PollClosedCandlesUseCase,
} from "@/src/modules/market";
import { parseConfiguration, parseSubscriptions } from "@/scripts/pollMarketData";

const hour = 3_600_000;
const origin = Date.parse("2026-08-09T08:00:00.000Z");

function candle(openTime: number, close = "105", isClosed = true): Candle {
  return {
    id: randomUUID(), pairSymbol: "BTCUSDC", interval: "1h", openTime: new Date(openTime),
    closeTime: new Date(openTime + hour - 1), open: "100", high: "110", low: "90", close,
    volume: "10", quoteVolume: "1000", trades: 20, isClosed, source: "BINANCE",
    receivedAt: new Date(openTime + hour),
  };
}

class MemoryRepository implements CandleRepository {
  readonly candles = new Map<number, Candle>();
  cursor: CandleIngestionCursor | null = null;
  errors: string[] = [];
  findById(id: string) {
    return Promise.resolve(Array.from(this.candles.values()).find((value) => value.id === id) ?? null);
  }
  findRange(_symbol: string, _interval: string, from: Date, to: Date) {
    return Promise.resolve(Array.from(this.candles.values()).filter((value) =>
      value.isClosed && value.openTime >= from && value.openTime <= to)
      .sort((left, right) => left.openTime.getTime() - right.openTime.getTime()));
  }
  saveMany(values: Candle[], checkpoint?: CandleIngestionCheckpoint) {
    for (const value of values) this.candles.set(value.openTime.getTime(), value);
    if (checkpoint) this.setCursor(checkpoint);
    return Promise.resolve();
  }
  find(_key: CandleIngestionKey) { return Promise.resolve(this.cursor); }
  recordError(_key: CandleIngestionKey, message: string) { this.errors.push(message); return Promise.resolve(); }
  advanceAfterVerifiedRange(checkpoint: CandleIngestionCheckpoint, contiguousFrom: Date) {
    for (let expected = contiguousFrom.getTime(); expected <= checkpoint.lastClosedOpenTime.getTime(); expected += hour)
      if (!this.candles.has(expected)) return Promise.reject(new Error("missing interval"));
    this.setCursor(checkpoint);
    return Promise.resolve();
  }
  private setCursor(checkpoint: CandleIngestionCheckpoint) {
    this.cursor = { id: randomUUID(), ...checkpoint, status: "HEALTHY", lastError: null,
      createdAt: new Date(), updatedAt: new Date() };
  }
}

class FixtureSource implements MarketDataSource {
  readonly requests: HistoricalCandleRequest[] = [];
  fail = false;
  constructor(readonly available: Candle[], readonly serverTime = new Date(origin + (4 * hour) + 5_000)) {}
  fetchServerTime() { return Promise.resolve({ serverTime: this.serverTime, clockOffsetMs: BigInt(25) }); }
  fetchHistoricalCandles(request: HistoricalCandleRequest) {
    this.requests.push(request);
    if (this.fail) return Promise.reject(new Error("exchange unavailable"));
    return Promise.resolve({ candles: this.available.filter((value) => value.isClosed &&
      value.openTime >= request.from && value.openTime < request.to),
    serverTime: this.serverTime, clockOffsetMs: BigInt(25) });
  }
}

class FixtureLease implements MarketDataLease {
  acquired = true;
  keys: MarketDataLeaseKey[] = [];
  async withLease<T>(key: MarketDataLeaseKey, work: () => Promise<T>): Promise<T | null> {
    this.keys.push(key);
    return this.acquired ? work() : null;
  }
}

describe("market-data subscription discovery", () => {
  test("merges, normalizes, sorts, and deduplicates discovered and configured subscriptions", async () => {
    const repository: MarketDataSubscriptionRepository = { findActive: () => Promise.resolve([
      { pairSymbol: "ethusdc", interval: "1h" },
      { pairSymbol: "BTCUSDC", interval: "15m" },
    ]) };
    const result = await new DiscoverMarketDataSubscriptionsUseCase(repository, [
      { pairSymbol: "ETHUSDC", interval: "1h" },
      { pairSymbol: "BTCUSDC", interval: "4h" },
    ]).execute();
    assert.deepEqual(result, [
      { pairSymbol: "BTCUSDC", interval: "15m" },
      { pairSymbol: "BTCUSDC", interval: "4h" },
      { pairSymbol: "ETHUSDC", interval: "1h" },
    ]);
  });
});

describe("closed-candle polling", () => {
  test("overlaps the cursor, applies corrections, persists closed candles, and advances", async () => {
    const repository = new MemoryRepository();
    repository.candles.set(origin + hour, candle(origin + hour, "101"));
    repository.candles.set(origin + (2 * hour), candle(origin + (2 * hour), "102"));
    repository.cursor = { id: randomUUID(), source: "BINANCE", pairSymbol: "BTCUSDC", interval: "1h",
      lastClosedOpenTime: new Date(origin + (2 * hour)), lastSuccessfulPollAt: new Date(),
      clockOffsetMs: BigInt(0), status: "HEALTHY", lastError: null, createdAt: new Date(), updatedAt: new Date() };
    const source = new FixtureSource([
      candle(origin + hour, "106"), candle(origin + (2 * hour), "107"),
      candle(origin + (3 * hour), "108"), candle(origin + (4 * hour), "109", false),
    ]);
    const lease = new FixtureLease();
    const result = await new PollClosedCandlesUseCase(repository, repository, source, lease).execute({
      pairSymbol: "btcusdc", interval: "1h",
    });

    assert.equal(source.requests[0].from.getTime(), origin + hour);
    assert.equal(source.requests[0].to.getTime(), origin + (4 * hour));
    assert.equal(repository.candles.get(origin + hour)?.close, "106");
    assert.equal(repository.candles.has(origin + (4 * hour)), false);
    assert.equal(repository.cursor?.lastClosedOpenTime?.getTime(), origin + (3 * hour));
    assert.equal(result.previousCursor?.getTime(), origin + (2 * hour));
    assert.equal(result.cursorAdvanced, true);
    assert.deepEqual(lease.keys, [{ source: "BINANCE", pairSymbol: "BTCUSDC", interval: "1h" }]);
  });

  test("bootstraps one closed interval when no cursor exists", async () => {
    const repository = new MemoryRepository();
    const source = new FixtureSource([candle(origin + (3 * hour))]);
    const result = await new PollClosedCandlesUseCase(repository, repository, source, new FixtureLease()).execute({
      pairSymbol: "BTCUSDC", interval: "1h",
    });
    assert.equal(result.range?.from.getTime(), origin + (3 * hour));
    assert.equal(repository.cursor?.lastClosedOpenTime?.getTime(), origin + (3 * hour));
  });

  test("skips without fetching when another worker holds the lease", async () => {
    const repository = new MemoryRepository();
    const source = new FixtureSource([]);
    const lease = new FixtureLease();
    lease.acquired = false;
    const result = await new PollClosedCandlesUseCase(repository, repository, source, lease).execute({
      pairSymbol: "BTCUSDC", interval: "1h",
    });
    assert.equal(result.status, "skipped");
    assert.equal(result.skipReason, "lease-unavailable");
    assert.equal(source.requests.length, 0);
  });

  test("records an error without advancing the persisted cursor", async () => {
    const repository = new MemoryRepository();
    const previous = new Date(origin + (2 * hour));
    repository.cursor = { id: randomUUID(), source: "BINANCE", pairSymbol: "BTCUSDC", interval: "1h",
      lastClosedOpenTime: previous, lastSuccessfulPollAt: new Date(), clockOffsetMs: BigInt(0),
      status: "HEALTHY", lastError: null, createdAt: new Date(), updatedAt: new Date() };
    const source = new FixtureSource([]);
    source.fail = true;
    await assert.rejects(() => new PollClosedCandlesUseCase(repository, repository, source,
      new FixtureLease()).execute({ pairSymbol: "BTCUSDC", interval: "1h" }), /exchange unavailable/);
    assert.deepEqual(repository.errors, ["exchange unavailable"]);
    assert.equal(repository.cursor.lastClosedOpenTime?.getTime(), previous.getTime());
  });

  test("bounds stale-cursor catch-up to one page and reports remaining work", async () => {
    const repository = new MemoryRepository();
    repository.cursor = { id: randomUUID(), source: "BINANCE", pairSymbol: "BTCUSDC", interval: "1h",
      lastClosedOpenTime: new Date(origin + (2 * hour)), lastSuccessfulPollAt: new Date(),
      clockOffsetMs: BigInt(0), status: "HEALTHY", lastError: null, createdAt: new Date(), updatedAt: new Date() };
    const available = Array.from({ length: 10 }, (_value, index) => candle(origin + ((index + 1) * hour)));
    const source = new FixtureSource(available, new Date(origin + (2_000 * hour)));
    const result = await new PollClosedCandlesUseCase(repository, repository, source,
      new FixtureLease()).execute({ pairSymbol: "BTCUSDC", interval: "1h", maxCandles: 10 });
    assert.equal(source.requests[0].from.getTime(), origin + hour);
    assert.equal(source.requests[0].to.getTime(), origin + (11 * hour));
    assert.equal(result.candlesFetched, 10);
    assert.equal(result.hasMoreWork, true);
    assert.equal(repository.cursor?.lastClosedOpenTime?.getTime(), origin + (10 * hour));
  });
});

describe("market-data polling worker", () => {
  test("aligns successful polling to the interval boundary plus close grace", () => {
    const repository: MarketDataSubscriptionRepository = { findActive: () => Promise.resolve([]) };
    const discover = new DiscoverMarketDataSubscriptionsUseCase(repository);
    const worker = new MarketDataPollingWorker(discover, {} as PollClosedCandlesUseCase,
      { closeGraceMs: 5_000 }, () => new Date("2026-08-09T10:42:31.000Z"));
    assert.equal(worker.nextBoundary({ pairSymbol: "BTCUSDC", interval: "1h" }).toISOString(),
      "2026-08-09T11:00:05.000Z");
    assert.equal(worker.nextBoundary({ pairSymbol: "BTCUSDC", interval: "1h" },
      new Date("2026-08-09T11:00:03.000Z")).toISOString(), "2026-08-09T11:00:05.000Z");
  });

  test("applies bounded per-subscription exponential backoff and resets it after success", async () => {
    const repository = new MemoryRepository();
    const source = new FixtureSource([]);
    source.fail = true;
    const discoveryRepository: MarketDataSubscriptionRepository = { findActive: () => Promise.resolve([
      { pairSymbol: "BTCUSDC", interval: "1h" },
    ]) };
    const now = new Date("2026-08-09T10:00:00.000Z");
    const worker = new MarketDataPollingWorker(
      new DiscoverMarketDataSubscriptionsUseCase(discoveryRepository),
      new PollClosedCandlesUseCase(repository, repository, source, new FixtureLease()),
      { baseBackoffMs: 1_000, maxBackoffMs: 2_000, backoffJitterRatio: 0 },
      () => now, undefined, () => 0.5);
    const first = (await worker.runOnce())[0];
    const second = (await worker.runOnce())[0];
    assert.equal(first.consecutiveFailures, 1);
    assert.equal(first.nextRunAt.getTime(), now.getTime() + 1_000);
    assert.equal(second.consecutiveFailures, 2);
    assert.equal(second.nextRunAt.getTime(), now.getTime() + 2_000);
    source.fail = false;
    const recovered = (await worker.runOnce())[0];
    assert.equal(recovered.consecutiveFailures, 0);
    assert.equal(recovered.error, undefined);
  });
});

describe("market-data poller configuration", () => {
  test("parses explicit subscriptions and one-shot CLI overrides", () => {
    assert.deepEqual(parseSubscriptions("btcusdc:15m, ETHUSDC:1h"), [
      { pairSymbol: "BTCUSDC", interval: "15m" }, { pairSymbol: "ETHUSDC", interval: "1h" },
    ]);
    const configuration = parseConfiguration(["--once", "--subscriptions", "BTCUSDC:4h",
      "--max-candles-per-poll=250"], {});
    assert.equal(configuration.once, true);
    assert.equal(configuration.maxCandlesPerPoll, 250);
    assert.deepEqual(configuration.subscriptions, [{ pairSymbol: "BTCUSDC", interval: "4h" }]);
  });
});
