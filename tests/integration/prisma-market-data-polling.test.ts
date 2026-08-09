import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { Candle, HistoricalCandleRequest, MarketDataSource } from "@/src/modules/market";
import { PollClosedCandlesUseCase } from "@/src/modules/market";
import { PrismaCandleRepository } from "@/src/modules/market/infrastructure/prisma/PrismaCandleRepository";
import { PrismaMarketDataLease } from "@/src/modules/market/infrastructure/prisma/PrismaMarketDataLease";

const openTime = new Date("2026-08-01T00:00:00.000Z");
const hour = 3_600_000;

function candle(pairSymbol: string, offset: number, close = "105"): Candle {
  const opening = new Date(openTime.getTime() + (offset * hour));
  return { id: randomUUID(), pairSymbol, interval: "1h", openTime: opening,
    closeTime: new Date(opening.getTime() + hour - 1), open: "100", high: "110", low: "90", close,
    volume: "10", quoteVolume: "1000", trades: 20, isClosed: true, source: "BINANCE",
    receivedAt: new Date(opening.getTime() + hour) };
}

class PrismaPollingSource implements MarketDataSource {
  readonly requests: HistoricalCandleRequest[] = [];
  constructor(private readonly candles: Candle[]) {}
  fetchServerTime() {
    return Promise.resolve({ serverTime: new Date(openTime.getTime() + (2 * hour) + 5_000),
      clockOffsetMs: BigInt(12) });
  }
  fetchHistoricalCandles(request: HistoricalCandleRequest) {
    this.requests.push(request);
    return Promise.resolve({ candles: this.candles.filter((value) =>
      value.openTime >= request.from && value.openTime < request.to),
    serverTime: new Date(openTime.getTime() + (2 * hour) + 5_000), clockOffsetMs: BigInt(12) });
  }
}

test("PostgreSQL advisory lease excludes concurrent work and releases afterward",
  { skip: !process.env.DATABASE_URL }, async () => {
    const { prisma } = await import("@/src/shared/infrastructure/prisma/prisma");
    const lease = new PrismaMarketDataLease(prisma);
    const key = { source: "BINANCE", pairSymbol: "LEASETESTUSDC", interval: "1h" as const };
    let release!: () => void;
    let entered!: () => void;
    const isEntered = new Promise<void>((resolve) => { entered = resolve; });
    const hold = new Promise<void>((resolve) => { release = resolve; });
    const first = lease.withLease(key, async () => { entered(); await hold; return "first"; });
    await isEntered;
    assert.equal(await lease.withLease(key, async () => "second"), null);
    release();
    assert.equal(await first, "first");
    assert.equal(await lease.withLease(key, async () => "third"), "third");
  });

test("two Prisma-backed polls are idempotent and the cursor remains monotonic",
  { skip: !process.env.DATABASE_URL }, async () => {
    const { prisma } = await import("@/src/shared/infrastructure/prisma/prisma");
    const pairSymbol = `P${randomUUID().replaceAll("-", "").slice(0, 8)}USDC`;
    await prisma.pair.create({ data: { symbol: pairSymbol, decimals: 8 } });
    const repository = new PrismaCandleRepository(prisma);
    const key = { source: "BINANCE", pairSymbol, interval: "1h" as const };
    const checkpoint = { ...key, lastClosedOpenTime: new Date(openTime.getTime() + hour),
      lastSuccessfulPollAt: new Date("2026-08-01T02:00:01.000Z"), clockOffsetMs: BigInt(0) };
    try {
      await repository.saveMany([candle(pairSymbol, 0), candle(pairSymbol, 1)], checkpoint);
      const source = new PrismaPollingSource([candle(pairSymbol, 0, "106"), candle(pairSymbol, 1, "106")]);
      const poll = new PollClosedCandlesUseCase(repository, repository, source,
        new PrismaMarketDataLease(prisma));

      await poll.execute({ pairSymbol, interval: "1h" });
      await poll.execute({ pairSymbol, interval: "1h" });

      assert.equal(await prisma.candle.count({ where: { pairSymbol } }), 2);
      assert.deepEqual((await repository.findRange(pairSymbol, "1h", openTime,
        new Date(openTime.getTime() + hour))).map((value) => value.close), ["106", "106"]);
      assert.equal(source.requests.length, 2);
      assert.deepEqual(source.requests.map((request) => request.from.getTime()),
        [openTime.getTime(), openTime.getTime()]);

      await repository.advanceAfterVerifiedRange({ ...checkpoint,
        lastClosedOpenTime: openTime }, openTime);
      assert.equal((await repository.find(key))?.lastClosedOpenTime?.getTime(),
        checkpoint.lastClosedOpenTime.getTime());
    } finally {
      await prisma.candle.deleteMany({ where: { pairSymbol } });
      await prisma.pair.delete({ where: { symbol: pairSymbol } });
    }
  });
