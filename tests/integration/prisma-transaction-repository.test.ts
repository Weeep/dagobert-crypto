import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { PrismaPairRepository } from "@/src/modules/pair/infrastructure/prisma/PrismaPairRepository";
import { PrismaTransactionRepository } from "@/src/modules/transaction/infrastructure/prisma/PrismaTransactionRepository";
import { TradeStyle, TradeType } from "@/src/modules/transaction";

const rollback = new Error("ROLLBACK_PRISMA_TRANSACTION_CONTRACT_TEST");

test(
  "Prisma transaction repository fulfils its write contract against PostgreSQL",
  { skip: !process.env.DATABASE_URL },
  async () => {
    const { prisma } = await import("@/src/shared/infrastructure/prisma/prisma");

    await assert.rejects(
      prisma.$transaction(async (transaction) => {
        const pairRepository = new PrismaPairRepository(
          transaction as unknown as PrismaClient
        );
        const repository = new PrismaTransactionRepository(
          transaction as unknown as PrismaClient
        );
        const symbol = `ZZTX${Date.now()}`;
        const baseTransaction = {
          orderId: `${symbol}-1`,
          binanceApiId: 42,
          pair: symbol,
          amount: -12.5,
          executed: 0.25,
          date: new Date("2026-01-02T03:04:05.000Z"),
          dateEpoch: 1767323045000,
          side: "BUY",
          price: 50,
          status: "FILLED",
          grouped: false,
          note: "created",
          otherSideOrderId: "",
          tradeType: TradeType.Spot,
          tradeStyle: TradeStyle.Swing,
        };

        await pairRepository.save({ pair: symbol, decimals: 4, keyLevels: [] });
        assert.equal(await repository.findById(baseTransaction.orderId), null);
        await repository.save(baseTransaction);
        assert.deepEqual(await repository.findById(baseTransaction.orderId), baseTransaction);

        const updated = { ...baseTransaction, note: "updated", otherSideOrderId: "other" };
        await repository.saveMany([updated]);
        assert.deepEqual(await repository.findById(updated.orderId), updated);

        assert.equal(await repository.getLastProcessedEpoch(symbol, TradeType.Spot), null);
        await repository.setLastProcessedEpoch(symbol, TradeType.Spot, 12345);
        assert.equal(await repository.getLastProcessedEpoch(symbol, TradeType.Spot), 12345);

        throw rollback;
      }),
      (error: unknown) => error === rollback
    );
  }
);
