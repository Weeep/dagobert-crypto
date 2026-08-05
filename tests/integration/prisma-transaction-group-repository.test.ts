import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { PrismaPairRepository } from "@/src/modules/pair/infrastructure/prisma/PrismaPairRepository";
import { PrismaTransactionRepository } from "@/src/modules/transaction/infrastructure/prisma/PrismaTransactionRepository";
import { PrismaTransactionGroupRepository } from "@/src/modules/transaction-group/infrastructure/prisma/PrismaTransactionGroupRepository";
import { TradeStyle, TradeType } from "@/src/modules/transaction";

const rollback = new Error("ROLLBACK_PRISMA_TRANSACTION_GROUP_CONTRACT_TEST");

test(
  "Prisma transaction-group repository fulfils its write contract against PostgreSQL",
  { skip: !process.env.DATABASE_URL },
  async () => {
    const { prisma } = await import("@/src/shared/infrastructure/prisma/prisma");

    await assert.rejects(
      prisma.$transaction(async (transaction) => {
        const pairRepository = new PrismaPairRepository(
          transaction as unknown as PrismaClient
        );
        const transactionRepository = new PrismaTransactionRepository(
          transaction as unknown as PrismaClient
        );
        const groupRepository = new PrismaTransactionGroupRepository(
          transaction as unknown as PrismaClient
        );
        const symbol = `ZZGRP${Date.now()}`;
        const firstTransaction = {
          orderId: `${symbol}-1`,
          binanceApiId: 101,
          pair: symbol,
          amount: -12.5,
          executed: 0.25,
          date: new Date("2026-01-02T03:04:05.000Z"),
          dateEpoch: 1767323045000,
          side: "BUY",
          price: 50,
          status: "FILLED",
          grouped: false,
          note: "",
          otherSideOrderId: "",
          tradeType: TradeType.Spot,
          tradeStyle: TradeStyle.Swing,
        };
        const secondTransaction = {
          ...firstTransaction,
          orderId: `${symbol}-2`,
          binanceApiId: 102,
          amount: 12.5,
          side: "SELL",
          price: 55,
          dateEpoch: 1767323046000,
        };
        const group = {
          groupId: "00000000-0000-0000-0000-000000000101",
          pair: symbol,
          amount: 0,
          executed: 0,
          tradeType: TradeType.Spot,
          lastTransDateEpoch: secondTransaction.dateEpoch,
          groupedTrans: [firstTransaction, secondTransaction],
          note: "integration group",
        };

        await pairRepository.save({ pair: symbol, decimals: 4, keyLevels: [] });
        await transactionRepository.saveMany([firstTransaction, secondTransaction]);
        await groupRepository.save(group);

        const savedGroup = await groupRepository.findById(group.groupId);
        assert.equal(savedGroup?.groupId, group.groupId);
        assert.deepEqual(
          savedGroup?.groupedTrans.map((groupedTransaction) => groupedTransaction.orderId).sort(),
          [firstTransaction.orderId, secondTransaction.orderId].sort()
        );
        assert.equal((await transactionRepository.findById(firstTransaction.orderId))?.grouped, true);

        await groupRepository.delete(group.groupId);
        assert.equal(await groupRepository.findById(group.groupId), null);
        assert.equal((await transactionRepository.findById(firstTransaction.orderId))?.grouped, false);

        throw rollback;
      }),
      (error: unknown) => error === rollback
    );
  }
);
