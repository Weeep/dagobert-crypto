import type { PrismaClient } from "@prisma/client";
import type { DagobertPair, PairRepository } from "@/src/modules/pair";

/** Prisma adapter for pair persistence. */
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

  async save(pair: DagobertPair): Promise<void> {
    const data = {
      decimals: pair.decimals,
      keyLevels: pair.keyLevels.map(String),
    };
    await this.prisma.pair.upsert({
      where: { symbol: pair.pair },
      create: { symbol: pair.pair, ...data },
      update: data,
    });
  }

  async delete(symbol: string): Promise<void> {
    await this.prisma.pair.deleteMany({ where: { symbol } });
  }
}
