import { Prisma, type PrismaClient } from "@prisma/client";
import type { BotLifecycleRepository, BotRun, BotStatus, TradingBot } from "@/src/modules/bot";

const mapBot = (row: Awaited<ReturnType<PrismaClient["bot"]["findFirstOrThrow"]>>): TradingBot => ({
  ...row, assignedBudget: row.assignedBudget.toString(), amountPerPosition: row.amountPerPosition.toString(),
  feeRate: row.feeRate.toString(), slippageRate: row.slippageRate.toString(), timeframe: row.timeframe as TradingBot["timeframe"],
});
export class PrismaBotLifecycleRepository implements BotLifecycleRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async start(bot: TradingBot, run: BotRun): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.bot.updateMany({ where: { id: bot.id, status: { in: ["DRAFT", "PAUSED"] } }, data: { status: "RUNNING" } });
      if (changed.count !== 1) return false;
      await tx.botRun.create({ data: { id: run.id, botId: run.botId, mode: run.mode, status: run.status,
        configurationSnapshot: run.configurationSnapshot as Prisma.InputJsonValue, strategySnapshot: run.strategySnapshot as Prisma.InputJsonValue,
        backtestFrom: run.backtestFrom, backtestTo: run.backtestTo, startedAt: run.startedAt } });
      await tx.botLedgerEntry.create({ data: { botRunId: run.id, type: "ALLOCATION", amount: bot.assignedBudget,
        balanceAfter: bot.assignedBudget, referenceType: "BOT_RUN", referenceId: run.id,
        description: "Initial virtual budget allocation", occurredAt: run.startedAt } });
      return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  async transition(botId: string, status: Extract<BotStatus, "PAUSED" | "STOPPED">): Promise<TradingBot | null> {
    return this.prisma.$transaction(async (tx) => {
      const bot = await tx.bot.findUnique({ where: { id: botId } }); if (!bot) return null;
      if (bot.status === status) return mapBot(bot);
      const allowed = bot.status === "RUNNING" || (bot.status === "PAUSED" && status === "STOPPED");
      if (!allowed) return null;
      const updated = await tx.bot.update({ where: { id: botId }, data: { status } });
      if (status === "STOPPED") await tx.botRun.updateMany({ where: { botId, status: "RUNNING" }, data: { status: "STOPPED", endedAt: new Date() } });
      return mapBot(updated);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
