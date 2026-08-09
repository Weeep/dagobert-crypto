import type { PrismaClient } from "@prisma/client";
import type { MarketDataLease, MarketDataLeaseKey } from "@/src/modules/market";

// PostgreSQL hashes the text identity into its native signed 64-bit advisory-lock key.
const lockIdentity = (key: MarketDataLeaseKey) =>
  `market-data:${key.source}:${key.pairSymbol}:${key.interval}`;

export class PrismaMarketDataLease implements MarketDataLease {
  constructor(private readonly prisma: PrismaClient) {}

  async withLease<T>(key: MarketDataLeaseKey, work: () => Promise<T>): Promise<T | null> {
    return this.prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<Array<{ acquired: boolean }>>`
        SELECT pg_try_advisory_xact_lock(hashtextextended(${lockIdentity(key)}, 0)) AS acquired
      `;
      if (rows[0]?.acquired !== true) return null;
      return work();
    }, { timeout: 60_000 });
  }
}

