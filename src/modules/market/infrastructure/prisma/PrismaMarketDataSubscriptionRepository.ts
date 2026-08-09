import type { PrismaClient } from "@prisma/client";
import type {
  MarketDataSubscription,
  MarketDataSubscriptionRepository,
} from "@/src/modules/market";
import { isMarketInterval } from "@/src/modules/market";

export class PrismaMarketDataSubscriptionRepository implements MarketDataSubscriptionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findActive(): Promise<MarketDataSubscription[]> {
    const rows = await this.prisma.bot.findMany({
      where: { status: "RUNNING", mode: { not: "BACKTEST" } },
      distinct: ["pairSymbol", "timeframe"],
      select: { pairSymbol: true, timeframe: true },
      orderBy: [{ pairSymbol: "asc" }, { timeframe: "asc" }],
    });
    return rows.map((row) => {
      if (!isMarketInterval(row.timeframe))
        throw new Error(`Running bot has unsupported timeframe: ${row.timeframe}`);
      return { pairSymbol: row.pairSymbol, interval: row.timeframe };
    });
  }
}

