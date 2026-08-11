import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { Candle } from "@/src/modules/market";
import { PrismaCandleRepository } from "@/src/modules/market/infrastructure/prisma/PrismaCandleRepository";

const openTime = new Date("2026-08-01T00:00:00.000Z");

function candle(id: string, pairSymbol: string, close = "105"): Candle {
  return {
    id, pairSymbol, interval: "1h", openTime,
    closeTime: new Date(openTime.getTime() + 3_600_000 - 1),
    open: "100", high: "110", low: "90", close,
    volume: "10", quoteVolume: "1000", trades: 20,
    isClosed: true, source: "BINANCE", receivedAt: new Date("2026-08-01T01:00:01.000Z"),
  };
}

test("candle upsert and cursor checkpoint are atomic, corrective, and monotonic",
  { skip: !process.env.DATABASE_URL }, async () => {
    const { prisma } = await import("@/src/shared/infrastructure/prisma/prisma");
    const suffix = randomUUID();
    const pairSymbol = `T${suffix.replaceAll("-", "").slice(0, 8)}USDC`;
    await prisma.pair.create({ data: { symbol: pairSymbol, decimals: 8 } });
    const repository = new PrismaCandleRepository(prisma);
    const checkpoint = {
      source: "BINANCE", pairSymbol, interval: "1h" as const,
      lastClosedOpenTime: openTime, lastSuccessfulPollAt: new Date("2026-08-01T01:00:02.000Z"),
      clockOffsetMs: BigInt(123),
    };
    try {
      await repository.saveMany([candle(randomUUID(), pairSymbol)], checkpoint);
      await repository.saveMany([candle(randomUUID(), pairSymbol, "106")], checkpoint);
      assert.equal(await prisma.candle.count({ where: { pairSymbol } }), 1);
      assert.equal((await repository.findRange(pairSymbol, "1h", openTime, openTime))[0].close, "106");
      assert.equal((await repository.find(checkpoint))?.clockOffsetMs, BigInt(123));

      const nextOpenTime = new Date(openTime.getTime() + 3_600_000);
      await repository.saveMany([{
        ...candle(randomUUID(), pairSymbol, "107"),
        openTime: nextOpenTime,
        closeTime: new Date(nextOpenTime.getTime() + 3_600_000 - 1),
      }]);
      await repository.advanceAfterVerifiedRange({
        ...checkpoint,
        lastClosedOpenTime: nextOpenTime,
      }, openTime);
      assert.equal((await repository.find(checkpoint))?.lastClosedOpenTime?.getTime(), nextOpenTime.getTime());

      const threeHoursLater = new Date(openTime.getTime() + (3 * 3_600_000));
      await assert.rejects(() => repository.saveMany([{
        ...candle(randomUUID(), pairSymbol),
        openTime: threeHoursLater,
        closeTime: new Date(threeHoursLater.getTime() + 3_600_000 - 1),
      }], {
        ...checkpoint,
        lastClosedOpenTime: threeHoursLater,
      }), /missing or duplicated interval/);
      assert.equal((await repository.find(checkpoint))?.lastClosedOpenTime?.getTime(), nextOpenTime.getTime());
      assert.equal(await prisma.candle.count({ where: { pairSymbol } }), 2);

      // This call exercises cursor monotonicity only. Keep the already corrected
      // candle value so the fixture does not accidentally request a correction
      // back from 106 to its helper default of 105.
      await repository.saveMany([candle(randomUUID(), pairSymbol, "106")], {
        ...checkpoint,
        lastClosedOpenTime: new Date(openTime.getTime() - 3_600_000),
        lastSuccessfulPollAt: new Date("2026-08-01T02:00:00.000Z"),
      });
      assert.equal((await repository.find(checkpoint))?.lastClosedOpenTime?.getTime(), nextOpenTime.getTime());

      await assert.rejects(() => repository.saveMany([
        { ...candle(randomUUID(), pairSymbol), close: "107" },
        candle(randomUUID(), "MISSINGUSDC"),
      ]));
      assert.equal((await repository.findRange(pairSymbol, "1h", openTime, openTime))[0].close, "106");
    } finally {
      // Candle deliberately restricts pair deletion, so remove the dependent
      // fixture before its parent. The ingestion cursor cascades with the pair.
      await prisma.candle.deleteMany({ where: { pairSymbol } });
      await prisma.pair.delete({ where: { symbol: pairSymbol } });
    }
  });

test("strategy-facing candle ranges explicitly exclude open candles",
  { skip: !process.env.DATABASE_URL }, async () => {
    const { prisma } = await import("@/src/shared/infrastructure/prisma/prisma");
    const pairSymbol = `C${randomUUID().replaceAll("-", "").slice(0, 8)}USDC`.toUpperCase();
    const repository = new PrismaCandleRepository(prisma);
    const closed = candle(randomUUID(), pairSymbol);
    const nextOpenTime = new Date(openTime.getTime() + 3_600_000);
    await prisma.pair.create({ data: { symbol: pairSymbol, decimals: 8 } });
    try {
      await prisma.candle.createMany({ data: [
        { ...closed },
        { ...closed, id: randomUUID(), openTime: nextOpenTime,
          closeTime: new Date(nextOpenTime.getTime() + 3_600_000 - 1), isClosed: false },
      ] });
      const eligible = await repository.findRange(pairSymbol, "1h", openTime, nextOpenTime);
      assert.deepEqual(eligible.map(({ openTime: time }) => time.getTime()), [openTime.getTime()]);
      assert.equal(eligible.every(({ isClosed }) => isClosed), true);
    } finally {
      await prisma.candle.deleteMany({ where: { pairSymbol } });
      await prisma.pair.delete({ where: { symbol: pairSymbol } });
    }
  });
