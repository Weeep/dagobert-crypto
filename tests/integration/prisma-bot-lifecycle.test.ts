import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { CreateBotUseCase, SetBotStatusUseCase, StartBotUseCase } from "@/src/modules/bot";
import { PrismaBotRepository } from "@/src/modules/bot/infrastructure/prisma/PrismaBotRepository";
import { PrismaBotRunRepository } from "@/src/modules/bot/infrastructure/prisma/PrismaBotRunRepository";
import { PrismaBotLifecycleRepository } from "@/src/modules/bot/infrastructure/prisma/PrismaBotLifecycleRepository";
import { PrismaStrategyRepository } from "@/src/modules/strategy/infrastructure/prisma/PrismaStrategyRepository";

test("bot start/pause/stop is idempotent and stores immutable snapshots transactionally",
  { skip: !process.env.DATABASE_URL }, async () => {
    const { prisma } = await import("@/src/shared/infrastructure/prisma/prisma");
    const suffix = randomUUID();
    const user = await prisma.user.create({ data: { email: `bot-${suffix}@example.test`, passwordHash: "test" } });
    await prisma.pair.upsert({ where: { symbol: "BTCUSDC" }, create: { symbol: "BTCUSDC", decimals: 8 }, update: {} });
    const strategy = await prisma.strategy.create({ data: { userId: user.id, name: `strategy-${suffix}`,
      versions: { create: { version: 1, schemaVersion: 1, definition: { entry: { action: "HOLD" } } } } }, include: { versions: true } });
    try {
      const bots = new PrismaBotRepository(prisma); const runs = new PrismaBotRunRepository(prisma);
      const strategies = new PrismaStrategyRepository(prisma); const lifecycleRepository = new PrismaBotLifecycleRepository(prisma);
      const created = await new CreateBotUseCase(bots, async () => user.id).execute({ userId: user.id, name: `bot-${suffix}`,
        pairSymbol: "BTCUSDC", assignedBudget: "55", amountPerPosition: "10", timeframe: "1h",
        strategyVersionId: strategy.versions[0].id });
      assert.equal(created.ok, true); if (!created.ok) return;
      const startUseCase = new StartBotUseCase(bots, runs, strategies, lifecycleRepository);
      const range = { from: new Date("2025-01-01T00:00:00Z"), to: new Date("2025-02-01T00:00:00Z") };
      const first = await startUseCase.execute(created.bot.id, range);
      const repeated = await startUseCase.execute(created.bot.id, range);
      assert.equal(first.ok, true); assert.equal(repeated.ok, true);
      if (!first.ok || !repeated.ok) return;
      assert.equal(repeated.run.id, first.run.id);
      assert.equal(await prisma.botRun.count({ where: { botId: created.bot.id } }), 1);
      assert.equal(await prisma.botLedgerEntry.count({ where: { botRunId: first.run.id, type: "ALLOCATION" } }), 1);
      const stored = await prisma.botRun.findUniqueOrThrow({ where: { id: first.run.id } });
      assert.equal((stored.configurationSnapshot as { name: string }).name, created.bot.name);
      assert.equal((stored.strategySnapshot as { id: string }).id, strategy.versions[0].id);

      const status = new SetBotStatusUseCase(bots, lifecycleRepository);
      assert.equal((await status.execute(created.bot.id, "PAUSED")).ok, true);
      assert.equal((await status.execute(created.bot.id, "PAUSED")).ok, true);
      assert.equal((await status.execute(created.bot.id, "STOPPED")).ok, true);
      assert.equal((await status.execute(created.bot.id, "STOPPED")).ok, true);
      assert.equal((await prisma.bot.findUniqueOrThrow({ where: { id: created.bot.id } })).status, "STOPPED");
      assert.equal((await prisma.botRun.findUniqueOrThrow({ where: { id: first.run.id } })).status, "STOPPED");
    } finally { await prisma.user.delete({ where: { id: user.id } }); }
  });
