import assert from "node:assert/strict";
import test, { describe } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { PrismaBotBudgetRepository } from "@/src/modules/bot/infrastructure/prisma/PrismaBotBudgetRepository";

type Reservation = { id: string; walletId: string; botRunId: string; orderIntentKey: string;
  amount: { toString(): string }; status: "PENDING" | "RELEASED" | "CONSUMED"; resolvedAt: Date | null };

function decimal(value: string) { return { toString: () => value }; }

function budgetPrisma(options: { walletBudget: string; botBudgets: Record<string, string> }): PrismaClient {
  const reservations: Reservation[] = [];
  const wallet = { id: "00000000-0000-0000-0000-000000000001", userId: "owner",
    lastReconciledFree: decimal(options.walletBudget), reconciliationStatus: "CURRENT" };
  let transactionTail = Promise.resolve();
  const tx = {
    $queryRaw: async () => [{ id: wallet.id }],
    walletReservation: {
      findUnique: async ({ where }: any) => reservations.find((item) => item.orderIntentKey === where.orderIntentKey) ?? null,
      aggregate: async ({ where }: any) => ({ _sum: { amount: decimal(reservations
        .filter((item) => item.status === where.status && (!where.walletId || item.walletId === where.walletId) && (!where.botRunId || item.botRunId === where.botRunId))
        .reduce((sum, item) => sum + Number(item.amount.toString()), 0).toString()) } }),
      create: async ({ data }: any) => { const value = { ...data, amount: decimal(data.amount), status: "PENDING", resolvedAt: null } as Reservation; reservations.push(value); return value; },
      update: async ({ where, data }: any) => { const value = reservations.find((item) => item.id === where.id)!; Object.assign(value, data); return value; },
    },
    botRun: { findUnique: async ({ where }: any) => options.botBudgets[where.id]
      ? { id: where.id, status: "RUNNING", bot: { userId: "owner", assignedBudget: decimal(options.botBudgets[where.id]) } } : null },
    tradingWallet: { findUnique: async ({ where }: any) => where.id === wallet.id ? wallet : null },
    botLedgerEntry: { aggregate: async ({ where }: any) => ({ _sum: { amount: decimal(options.botBudgets[where.botRunId]) } }) },
  };
  return {
    $transaction: (callback: (client: typeof tx) => unknown) => {
      const result = transactionTail.then(() => callback(tx));
      transactionTail = result.then(() => undefined, () => undefined);
      return result;
    },
  } as unknown as PrismaClient;
}

describe("Prisma bot budget reservations", () => {
  test("multiple positions cannot reserve more than the bot's assigned USDC", async () => {
    const repository = new PrismaBotBudgetRepository(budgetPrisma({ walletBudget: "100", botBudgets: { run1: "50" } }));
    assert.equal((await repository.reserve({ botRunId: "run1", walletId: "00000000-0000-0000-0000-000000000001", orderIntentKey: "position-1", amount: "20" })).ok, true);
    assert.equal((await repository.reserve({ botRunId: "run1", walletId: "00000000-0000-0000-0000-000000000001", orderIntentKey: "position-2", amount: "20" })).ok, true);
    assert.equal((await repository.reserve({ botRunId: "run1", walletId: "00000000-0000-0000-0000-000000000001", orderIntentKey: "position-3", amount: "15" })).ok, false);
    assert.equal(await repository.release("position-1"), true);
    assert.equal(await repository.release("position-1"), true);
    assert.equal((await repository.reserve({ botRunId: "run1", walletId: "00000000-0000-0000-0000-000000000001", orderIntentKey: "position-3", amount: "15" })).ok, true);
  });

  test("concurrent bots cannot over-reserve their shared owner wallet", async () => {
    const repository = new PrismaBotBudgetRepository(budgetPrisma({ walletBudget: "60", botBudgets: { run1: "100", run2: "100" } }));
    const results = await Promise.all([
      repository.reserve({ botRunId: "run1", walletId: "00000000-0000-0000-0000-000000000001", orderIntentKey: "bot-1", amount: "40" }),
      repository.reserve({ botRunId: "run2", walletId: "00000000-0000-0000-0000-000000000001", orderIntentKey: "bot-2", amount: "40" }),
    ]);
    assert.equal(results.filter((result) => result.ok).length, 1);
  });
});
