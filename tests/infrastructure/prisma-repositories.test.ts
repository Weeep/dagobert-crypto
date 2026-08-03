import assert from "node:assert/strict";
import test, { describe } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { PrismaPairRepository } from "@/src/modules/pair/infrastructure/prisma/PrismaPairRepository";
import { PrismaTransactionRepository } from "@/src/modules/transaction/infrastructure/prisma/PrismaTransactionRepository";
import { PrismaTransactionGroupRepository } from "@/src/modules/transaction-group/infrastructure/prisma/PrismaTransactionGroupRepository";
import { TradeStyle, TradeType } from "@/src/modules/transaction";

const transactionRow = {
  orderId: "tx-1",
  binanceApiId: BigInt(12),
  pairSymbol: "SOLUSDC",
  amount: { toString: () => "-50" },
  executed: { toString: () => "0.5" },
  date: new Date("2025-01-02T12:00:00.000Z"),
  dateEpoch: BigInt(1735819200000),
  side: "BUY",
  price: { toString: () => "100" },
  status: "FILLED",
  grouped: true,
  note: "note",
  otherSideOrderId: null,
  tradeType: "spot",
  tradeStyle: "swing",
};

function asPrisma(value: object): PrismaClient {
  return value as unknown as PrismaClient;
}

describe("Prisma repository contracts", () => {
  test("pair repository maps decimals and supports idempotent save/delete", async () => {
    const calls: Array<{ operation: string; args: unknown }> = [];
    const row = {
      symbol: "SOLUSDC",
      decimals: 3,
      keyLevels: [{ toString: () => "12.5" }],
    };
    const repository = new PrismaPairRepository(asPrisma({
      pair: {
        findMany: async () => [row],
        findUnique: async ({ where }: any) =>
          where.symbol === row.symbol ? row : null,
        upsert: async (args: unknown) => calls.push({ operation: "upsert", args }),
        deleteMany: async (args: unknown) => calls.push({ operation: "deleteMany", args }),
      },
    }));

    const pair = { pair: "SOLUSDC", decimals: 3, keyLevels: [12.5] };
    assert.deepEqual(await repository.findAll(), [pair]);
    assert.deepEqual(await repository.findBySymbol("SOLUSDC"), pair);
    assert.equal(await repository.findBySymbol("MISSING"), null);
    await repository.save(pair);
    await repository.delete(pair.pair);

    assert.deepEqual(calls, [
      {
        operation: "upsert",
        args: {
          where: { symbol: "SOLUSDC" },
          create: { symbol: "SOLUSDC", decimals: 3, keyLevels: ["12.5"] },
          update: { decimals: 3, keyLevels: ["12.5"] },
        },
      },
      { operation: "deleteMany", args: { where: { symbol: "SOLUSDC" } } },
    ]);
  });

  test("transaction repository maps relational fields and import cursors", async () => {
    const repository = new PrismaTransactionRepository(asPrisma({
      transaction: {
        findMany: async () => [transactionRow],
        findUnique: async ({ where }: any) =>
          where.orderId === transactionRow.orderId ? transactionRow : null,
      },
      importCursor: {
        findUnique: async ({ where }: any) =>
          where.pairSymbol_tradeType.pairSymbol === "SOLUSDC"
            ? { lastProcessedEpoch: BigInt(1234) }
            : null,
      },
    }));

    const expected = {
      orderId: "tx-1", binanceApiId: 12, pair: "SOLUSDC", amount: -50,
      executed: 0.5, date: transactionRow.date, dateEpoch: 1735819200000,
      side: "BUY", price: 100, status: "FILLED", grouped: true, note: "note",
      otherSideOrderId: "", tradeType: TradeType.Spot, tradeStyle: TradeStyle.Swing,
    };
    assert.deepEqual(await repository.findAll(), [expected]);
    assert.deepEqual(await repository.findById("tx-1"), expected);
    assert.equal(await repository.findById("missing"), null);
    assert.equal(await repository.getLastProcessedEpoch("SOLUSDC", TradeType.Spot), 1234);
  });

  test("transaction-group repository includes mapped member transactions", async () => {
    const groupRow = {
      id: "00000000-0000-0000-0000-000000000001",
      pairSymbol: "SOLUSDC",
      amount: { toString: () => "-50" },
      executed: { toString: () => "0.5" },
      tradeType: "spot",
      lastTransDateEpoch: BigInt(1735819200000),
      note: "group note",
      transactions: [transactionRow],
    };
    const repository = new PrismaTransactionGroupRepository(asPrisma({
      transactionGroup: {
        findMany: async () => [groupRow],
        findUnique: async ({ where }: any) =>
          where.id === groupRow.id ? groupRow : null,
      },
    }));

    const groups = await repository.findAll();
    assert.equal(groups[0].groupId, groupRow.id);
    assert.equal(groups[0].amount, -50);
    assert.equal(groups[0].groupedTrans[0].orderId, "tx-1");
    assert.deepEqual(await repository.findById(groupRow.id), groups[0]);
    assert.equal(await repository.findById("missing"), null);
  });
});
