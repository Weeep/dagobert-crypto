import assert from "node:assert/strict";
import test from "node:test";
import { PrismaMarketDataLease } from "@/src/modules/market/infrastructure/prisma/PrismaMarketDataLease";

test("PostgreSQL advisory lease excludes concurrent work and releases afterward",
  { skip: !process.env.DATABASE_URL }, async () => {
    const { prisma } = await import("@/src/shared/infrastructure/prisma/prisma");
    const lease = new PrismaMarketDataLease(prisma);
    const key = { source: "BINANCE", pairSymbol: "LEASETESTUSDC", interval: "1h" as const };
    let release!: () => void;
    let entered!: () => void;
    const isEntered = new Promise<void>((resolve) => { entered = resolve; });
    const hold = new Promise<void>((resolve) => { release = resolve; });
    const first = lease.withLease(key, async () => { entered(); await hold; return "first"; });
    await isEntered;
    assert.equal(await lease.withLease(key, async () => "second"), null);
    release();
    assert.equal(await first, "first");
    assert.equal(await lease.withLease(key, async () => "third"), "third");
  });
