import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { EvaluateStrategyForClosedCandleUseCase, AddStrategyVersionUseCase } from "@/src/modules/strategy";
import { PrismaStrategyEvaluationRepository } from "@/src/modules/strategy/infrastructure/prisma/PrismaStrategyEvaluationRepository";
import { PrismaStrategyRepository } from "@/src/modules/strategy/infrastructure/prisma/PrismaStrategyRepository";
import { PrismaBotRunRepository } from "@/src/modules/bot/infrastructure/prisma/PrismaBotRunRepository";
import { PrismaCandleRepository } from "@/src/modules/market/infrastructure/prisma/PrismaCandleRepository";

const definition = (name: string) => ({ schemaVersion: 1, name,
  entry: { all: [{ candleSequence: { count: 1, direction: "RED", minimumBodyChangePct: 0 } }] },
  exit: { all: [{ candleSequence: { count: 1, direction: "GREEN", minimumBodyChangePct: 0 } }] } });

test("closed-candle evaluation is atomic/idempotent and strategy version numbers are concurrency-safe",
  { skip: !process.env.DATABASE_URL }, async () => {
    const { prisma } = await import("@/src/shared/infrastructure/prisma/prisma");
    const suffix = randomUUID();
    const user = await prisma.user.create({ data: { email: `evaluation-${suffix}@example.test`, passwordHash: "test" } });
    await prisma.pair.upsert({ where: { symbol: "BTCUSDC" }, create: { symbol: "BTCUSDC", decimals: 8 }, update: {} });
    const strategy = await prisma.strategy.create({ data: { userId: user.id, name: `strategy-${suffix}`,
      versions: { create: { version: 1, schemaVersion: 1, definition: definition("v1") } } }, include: { versions: true } });
    const bot = await prisma.bot.create({ data: { userId: user.id, name: `bot-${suffix}`, pairSymbol: "BTCUSDC",
      assignedBudget: "20", amountPerPosition: "10", timeframe: "1h", strategyVersionId: strategy.versions[0].id } });
    const run = await prisma.botRun.create({ data: { botId: bot.id, mode: "BACKTEST", status: "RUNNING",
      configurationSnapshot: { pairSymbol: "BTCUSDC", timeframe: "1h" },
      strategySnapshot: { schemaVersion: 1, definition: definition("v1") } } });
    const openTime = new Date(Date.UTC(2020, 0, 1) + Math.floor(Math.random() * 1_000_000_000));
    const candle = await prisma.candle.create({ data: { pairSymbol: "BTCUSDC", interval: "1h", openTime,
      closeTime: new Date(openTime.getTime() + 3_600_000 - 1), open: "101", high: "102", low: "98",
      close: "99", volume: "1", quoteVolume: "100", trades: 1, isClosed: true, source: "TEST" } });
    try {
      const useCase = new EvaluateStrategyForClosedCandleUseCase(
        new PrismaBotRunRepository(prisma), new PrismaCandleRepository(prisma),
        new PrismaStrategyEvaluationRepository(prisma),
      );
      const results = await Promise.all([
        useCase.execute(run.id, candle.id), useCase.execute(run.id, candle.id),
      ]);
      assert.equal(results.every((result) => result.ok), true);
      assert.equal(await prisma.strategyDecision.count({ where: { botRunId: run.id, candleId: candle.id } }), 1);
      assert.equal(await prisma.indicatorSnapshot.count({ where: { botRunId: run.id, candleId: candle.id } }), 1);

      const versions = new AddStrategyVersionUseCase(new PrismaStrategyRepository(prisma));
      const created = await Promise.all([
        versions.execute(user.id, strategy.id, definition("v2")),
        versions.execute(user.id, strategy.id, definition("v3")),
      ]);
      assert.equal(created.every((result) => result.ok), true);
      assert.deepEqual((await prisma.strategyVersion.findMany({ where: { strategyId: strategy.id },
        orderBy: { version: "asc" }, select: { version: true } })).map((item) => item.version), [1, 2, 3]);
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
      await prisma.candle.delete({ where: { id: candle.id } });
    }
  });
