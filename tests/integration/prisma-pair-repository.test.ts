import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { PrismaPairRepository } from "@/src/modules/pair/infrastructure/prisma/PrismaPairRepository";

const rollback = new Error("ROLLBACK_PRISMA_PAIR_CONTRACT_TEST");

test(
  "Prisma pair repository fulfils its contract against PostgreSQL",
  { skip: !process.env.DATABASE_URL },
  async () => {
    const { prisma } = await import("@/src/shared/infrastructure/prisma/prisma");

    await assert.rejects(
      prisma.$transaction(async (transaction) => {
        const repository = new PrismaPairRepository(
          transaction as unknown as PrismaClient
        );
        const symbol = `ZZCONTRACT${Date.now()}`;
        const created = { pair: symbol, decimals: 4, keyLevels: [1.25, 2.5] };
        const updated = { ...created, decimals: 6, keyLevels: [3.75] };

        assert.equal(await repository.findBySymbol(symbol), null);
        await repository.save(created);
        assert.deepEqual(await repository.findBySymbol(symbol), created);
        await repository.save(updated);
        assert.deepEqual(await repository.findBySymbol(symbol), updated);
        assert.equal(
          (await repository.findAll()).some((pair) => pair.pair === symbol),
          true
        );
        await repository.delete(symbol);
        assert.equal(await repository.findBySymbol(symbol), null);

        throw rollback;
      }),
      (error: unknown) => error === rollback
    );
  }
);
