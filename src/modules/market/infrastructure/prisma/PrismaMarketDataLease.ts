import type { PrismaClient } from "@prisma/client";
import type { MarketDataLease, MarketDataLeaseKey } from "@/src/modules/market";

// PostgreSQL hashes the text identity into its native signed 64-bit advisory-lock key.
const lockIdentity = (key: MarketDataLeaseKey) =>
  `market-data:${key.source}:${key.pairSymbol}:${key.interval}`;

export class PrismaMarketDataLease implements MarketDataLease {
  constructor(private readonly prisma: PrismaClient,
    private readonly transactionTimeoutMs = 15 * 60_000) {
    if (!Number.isInteger(transactionTimeoutMs) || transactionTimeoutMs < 1)
      throw new Error("transactionTimeoutMs must be a positive integer");
  }

  async withLease<T>(key: MarketDataLeaseKey, work: () => Promise<T>): Promise<T | null> {
    return this.prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<Array<{ acquired: boolean }>>`
        SELECT pg_try_advisory_xact_lock(hashtextextended(${lockIdentity(key)}, 0)) AS acquired
      `;
      if (rows[0]?.acquired !== true) return null;
      return work();
    }, { timeout: this.transactionTimeoutMs });
  }
}
