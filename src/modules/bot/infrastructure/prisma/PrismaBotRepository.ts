import type { PrismaClient } from "@prisma/client";
import type { BotRepository, TradingBot } from "@/src/modules/bot";

type BotRow = Awaited<ReturnType<PrismaClient["bot"]["findFirstOrThrow"]>>;

function mapBot(row: BotRow): TradingBot {
  return {
    id: row.id, userId: row.userId, name: row.name, pairSymbol: row.pairSymbol,
    assignedBudget: row.assignedBudget.toString(), amountPerPosition: row.amountPerPosition.toString(),
    timeframe: row.timeframe as TradingBot["timeframe"], mode: row.mode, status: row.status,
    strategyVersionId: row.strategyVersionId, feeRate: row.feeRate.toString(),
    slippageRate: row.slippageRate.toString(), createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

export class PrismaBotRepository implements BotRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async findAllByUserId(userId: string) {
    return (await this.prisma.bot.findMany({ where: { userId } })).map(mapBot);
  }
  async findById(id: string) {
    const row = await this.prisma.bot.findUnique({ where: { id } });
    return row ? mapBot(row) : null;
  }
  async findByUserIdAndName(userId: string, name: string) {
    const row = await this.prisma.bot.findUnique({ where: { userId_name: { userId, name } } });
    return row ? mapBot(row) : null;
  }
  async save(bot: TradingBot) {
    const data = {
      userId: bot.userId, name: bot.name, pairSymbol: bot.pairSymbol,
      assignedBudget: bot.assignedBudget, amountPerPosition: bot.amountPerPosition,
      timeframe: bot.timeframe, mode: bot.mode, status: bot.status,
      strategyVersionId: bot.strategyVersionId, feeRate: bot.feeRate,
      slippageRate: bot.slippageRate, createdAt: bot.createdAt, updatedAt: bot.updatedAt,
    };
    await this.prisma.bot.upsert({ where: { id: bot.id }, create: { id: bot.id, ...data }, update: data });
  }
}
