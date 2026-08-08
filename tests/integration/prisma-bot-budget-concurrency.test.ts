import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaBotBudgetRepository } from "@/src/modules/bot/infrastructure/prisma/PrismaBotBudgetRepository";

test("concurrent bot runs cannot over-reserve a shared PostgreSQL wallet",
  { skip: !process.env.DATABASE_URL }, async () => {
    const { prisma } = await import("@/src/shared/infrastructure/prisma/prisma");
    const suffix = randomUUID();
    const user = await prisma.user.create({
      data: {
        email: `budget-${suffix}@example.test`,
        passwordHash: "test",
        strategies: {
          create: {
            name: `strategy-${suffix}`,
            versions: { create: { version: 1, definition: { entry: { action: "HOLD" } } } },
          },
        },
      },
      include: { strategies: { include: { versions: true } } },
    });
    const pairSymbol = `T${suffix.replaceAll("-", "").slice(0, 8)}USDC`;
    await prisma.pair.create({ data: { symbol: pairSymbol, decimals: 8 } });
    try {
      const strategyVersionId = user.strategies[0].versions[0].id;
      const runs = await Promise.all(["first", "second"].map(async (name) => {
        const bot = await prisma.bot.create({
          data: {
            userId: user.id, name, pairSymbol, assignedBudget: "100",
            amountPerPosition: "40", timeframe: "15m", status: "RUNNING",
            strategyVersionId,
          },
        });
        return prisma.botRun.create({
          data: {
            botId: bot.id, mode: "PAPER", status: "RUNNING",
            configurationSnapshot: {}, strategySnapshot: {},
          },
        });
      }));
      const wallet = await prisma.tradingWallet.create({
        data: {
          userId: user.id, exchange: "BINANCE", account: suffix,
          environment: "TEST", quoteAsset: "USDC", lastReconciledFree: "60",
          reconciliationStatus: "CURRENT", reconciledAt: new Date(),
        },
      });
      const repository = new PrismaBotBudgetRepository(prisma);
      const results = await Promise.all(runs.map((run, index) => repository.reserve({
        botRunId: run.id,
        walletId: wallet.id,
        orderIntentKey: `${suffix}-${index}`,
        amount: "40",
      })));

      assert.equal(results.filter((result) => result.ok).length, 1);
      assert.equal(await prisma.walletReservation.count({
        where: { walletId: wallet.id, status: "PENDING" },
      }), 1);
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
      await prisma.pair.delete({ where: { symbol: pairSymbol } });
    }
  });
