import type { PrismaClient } from "@prisma/client";
import type { DagobertPair, PairRepository } from "@/src/modules/pair";

function readOnly(): never {
  throw new Error("The temporary PostgreSQL comparison source is read-only");
}

/** Prisma adapter for pair persistence; writes stay disabled during comparison. */
export class PrismaPairRepository implements PairRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(): Promise<DagobertPair[]> {
    const rows = await this.prisma.pair.findMany();
    return rows.map((row) => ({
      pair: row.symbol,
      decimals: row.decimals,
      keyLevels: row.keyLevels.map(Number),
    }));
  }

  async findBySymbol(symbol: string): Promise<DagobertPair | null> {
    const row = await this.prisma.pair.findUnique({ where: { symbol } });
    return row
      ? {
          pair: row.symbol,
          decimals: row.decimals,
          keyLevels: row.keyLevels.map(Number),
        }
      : null;
  }

  async save(): Promise<void> {
    readOnly();
  }

  async delete(): Promise<void> {
    readOnly();
  }
}
