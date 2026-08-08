import { Prisma, type PrismaClient } from "@prisma/client";
import type { BotRun, BotRunRepository } from "@/src/modules/bot";

type RunRow = Awaited<ReturnType<PrismaClient["botRun"]["findFirstOrThrow"]>>;
const json = (value: unknown) => value as Prisma.InputJsonValue;
const mapRun = (row: RunRow): BotRun => ({
  id: row.id, botId: row.botId, mode: row.mode, status: row.status,
  configurationSnapshot: row.configurationSnapshot, strategySnapshot: row.strategySnapshot,
  backtestFrom: row.backtestFrom, backtestTo: row.backtestTo, startedAt: row.startedAt,
  endedAt: row.endedAt, errorMessage: row.errorMessage,
});

export class PrismaBotRunRepository implements BotRunRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async findById(id: string) {
    const row = await this.prisma.botRun.findUnique({ where: { id } });
    return row ? mapRun(row) : null;
  }
  async findAllByBotId(botId: string) {
    return (await this.prisma.botRun.findMany({ where: { botId }, orderBy: { startedAt: "desc" } })).map(mapRun);
  }
  async save(run: BotRun) {
    const data = {
      botId: run.botId, mode: run.mode, status: run.status,
      configurationSnapshot: json(run.configurationSnapshot), strategySnapshot: json(run.strategySnapshot),
      backtestFrom: run.backtestFrom, backtestTo: run.backtestTo, startedAt: run.startedAt,
      endedAt: run.endedAt, errorMessage: run.errorMessage,
    };
    await this.prisma.botRun.upsert({ where: { id: run.id }, create: { id: run.id, ...data }, update: data });
  }
}
