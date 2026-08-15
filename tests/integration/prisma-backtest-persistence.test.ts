import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import type { Candle } from "@/src/modules/market";
import { runHistoricalBacktest } from "@/src/modules/bot";
import { PrismaBacktestRunPersistenceRepository } from
  "@/src/modules/bot/infrastructure/prisma/PrismaBacktestRunPersistenceRepository";
import type { StrategyDefinitionV1 } from "@/src/modules/strategy";

const definition: StrategyDefinitionV1 = { schemaVersion: 1, name: "Persistence integration",
  entry: { candleSequence: { count: 1, direction: "GREEN", minimumBodyChangePct: 0 } },
  exit: { candleSequence: { count: 1, direction: "RED", minimumBodyChangePct: 0 } } };

test("completed backtest persistence is atomic, replay-complete, and idempotent",
  { skip: !process.env.DATABASE_URL }, async () => {
    const { prisma } = await import("@/src/shared/infrastructure/prisma/prisma");
    const suffix = randomUUID();
    const user = await prisma.user.create({ data: { email: `backtest-${suffix}@example.test`, passwordHash: "test" } });
    await prisma.pair.upsert({ where: { symbol: "BTCUSDC" }, create: { symbol: "BTCUSDC", decimals: 8 }, update: {} });
    const strategy = await prisma.strategy.create({ data: { userId: user.id, name: `backtest-${suffix}`,
      versions: { create: { version: 1, schemaVersion: 1, definition } } }, include: { versions: true } });
    const bot = await prisma.bot.create({ data: { userId: user.id, name: `backtest-${suffix}`,
      pairSymbol: "BTCUSDC", assignedBudget: "55", amountPerPosition: "10", timeframe: "1h",
      feeRate: "0.001", slippageRate: "0.005", status: "RUNNING",
      strategyVersionId: strategy.versions[0].id } });
    const base = Date.UTC(2024, 0, 1) + Math.floor(Math.random() * 10_000) * 3_600_000;
    const prices = [["100", "101"], ["102", "103"], ["104", "100"], ["110", "112"]];
    const storedCandles = [];
    for (let index = 0; index < prices.length; index += 1) {
      const [open, close] = prices[index];
      const openTime = new Date(base + index * 3_600_000);
      storedCandles.push(await prisma.candle.create({ data: { pairSymbol: "BTCUSDC", interval: "1h", openTime,
        closeTime: new Date(openTime.getTime() + 3_599_999), open, high: "120", low: "90", close,
        volume: "1", quoteVolume: "100", trades: 1, isClosed: true, source: "TEST" } }));
    }
    const run = await prisma.botRun.create({ data: { botId: bot.id, mode: "BACKTEST", status: "RUNNING",
      configurationSnapshot: { assignedBudget: "55" }, strategySnapshot: { definition },
      backtestFrom: storedCandles[0].openTime, backtestTo: storedCandles.at(-1)!.openTime,
      ledgerEntries: { create: { type: "ALLOCATION", amount: "55", balanceAfter: "55",
        referenceType: "BOT_RUN", description: "Initial virtual budget allocation" } } } });
    const candles: Candle[] = storedCandles.map((item) => ({ ...item, interval: item.interval as Candle["interval"],
      open: item.open.toString(),
      high: item.high.toString(), low: item.low.toString(), close: item.close.toString(),
      volume: item.volume.toString(), quoteVolume: item.quoteVolume.toString() }));
    const result = runHistoricalBacktest({ definition, candles, backtestFrom: candles[0].openTime,
      backtestTo: candles.at(-1)!.openTime,
      execution: { assignedBudget: "55", amountPerPosition: "10", feeRate: "0.001", slippageRate: "0.005" } });
    try {
      const repository = new PrismaBacktestRunPersistenceRepository(prisma);
      const persisted = await Promise.all([repository.persistCompleted(run.id, result),
        repository.persistCompleted(run.id, result)]);
      assert.equal(persisted.filter((item) => item.reused).length, 1);
      assert.equal(await prisma.position.count({ where: { botRunId: run.id } }), 2);
      assert.equal(await prisma.botOrder.count({ where: { botRunId: run.id } }), 4);
      assert.equal(await prisma.fill.count({ where: { botOrder: { botRunId: run.id } } }), 4);
      assert.equal(await prisma.strategyDecision.count({ where: { botRunId: run.id } }), 4);
      assert.equal(await prisma.indicatorSnapshot.count({ where: { botRunId: run.id } }), 4);
      assert.equal(await prisma.botEvent.count({ where: { botRunId: run.id } }), result.events.length);
      assert.equal(await prisma.portfolioSnapshot.count({ where: { botRunId: run.id } }), result.snapshots.length);
      assert.equal((await prisma.botRun.findUniqueOrThrow({ where: { id: run.id } })).status, "COMPLETED");
      assert.equal((await prisma.bot.findUniqueOrThrow({ where: { id: bot.id } })).status, "PAUSED");
      const ledger = await prisma.botLedgerEntry.findMany({ where: { botRunId: run.id } });
      assert.equal(ledger.filter((entry) => entry.type === "ALLOCATION").length, 1);
      assert.ok(Math.abs(ledger.reduce((sum, entry) => sum + Number(entry.amount), 0) -
        Number(result.portfolio.cash)) < 1e-12);
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
      await prisma.candle.deleteMany({ where: { id: { in: storedCandles.map((item) => item.id) } } });
    }
  });

test("a persistence failure rolls back every generated trading record",
  { skip: !process.env.DATABASE_URL }, async () => {
    const { prisma } = await import("@/src/shared/infrastructure/prisma/prisma");
    const suffix = randomUUID();
    const user = await prisma.user.create({ data: { email: `rollback-${suffix}@example.test`, passwordHash: "test" } });
    await prisma.pair.upsert({ where: { symbol: "BTCUSDC" }, create: { symbol: "BTCUSDC", decimals: 8 }, update: {} });
    const strategy = await prisma.strategy.create({ data: { userId: user.id, name: `rollback-${suffix}`,
      versions: { create: { version: 1, schemaVersion: 1, definition } } }, include: { versions: true } });
    const bot = await prisma.bot.create({ data: { userId: user.id, name: `rollback-${suffix}`,
      pairSymbol: "BTCUSDC", assignedBudget: "55", amountPerPosition: "10", timeframe: "1h",
      strategyVersionId: strategy.versions[0].id } });
    const run = await prisma.botRun.create({ data: { botId: bot.id, mode: "BACKTEST", status: "RUNNING",
      configurationSnapshot: {}, strategySnapshot: {}, ledgerEntries: { create: { type: "ALLOCATION",
        amount: "55", balanceAfter: "55", description: "allocation" } } } });
    const fakeCandles = [0, 1].map((index): Candle => { const openTime = new Date(Date.UTC(2023, 0, 1, index));
      return { id: randomUUID(), pairSymbol: "BTCUSDC", interval: "1h", openTime,
        closeTime: new Date(openTime.getTime() + 3_599_999), open: "100", high: "102", low: "99",
        close: "101", volume: "1", quoteVolume: "100", trades: 1, isClosed: true, source: "TEST",
        receivedAt: new Date() }; });
    const result = runHistoricalBacktest({ definition, candles: fakeCandles,
      backtestFrom: fakeCandles[0].openTime, backtestTo: fakeCandles[1].openTime,
      execution: { assignedBudget: "55", amountPerPosition: "10", feeRate: "0.001", slippageRate: "0" } });
    try {
      await assert.rejects(() => new PrismaBacktestRunPersistenceRepository(prisma).persistCompleted(run.id, result));
      assert.equal(await prisma.position.count({ where: { botRunId: run.id } }), 0);
      assert.equal(await prisma.botOrder.count({ where: { botRunId: run.id } }), 0);
      assert.equal(await prisma.botLedgerEntry.count({ where: { botRunId: run.id } }), 1);
      assert.equal((await prisma.botRun.findUniqueOrThrow({ where: { id: run.id } })).status, "RUNNING");
    } finally { await prisma.user.delete({ where: { id: user.id } }); }
  });
