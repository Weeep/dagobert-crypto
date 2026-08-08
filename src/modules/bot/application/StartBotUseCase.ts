import { randomUUID } from "node:crypto";
import type { StrategyRepository } from "@/src/modules/strategy";
import type { BotRepository } from "../domain/BotRepository";
import type { BotRunRepository } from "../domain/BotRunRepository";
import type { BotRun } from "../domain/TradingBot";

export class StartBotUseCase {
  constructor(
    private readonly bots: BotRepository,
    private readonly runs: BotRunRepository,
    private readonly strategies: StrategyRepository
  ) {}

  async execute(botId: string, range?: { from: Date; to: Date }) {
    const bot = await this.bots.findById(botId);
    if (!bot) return { ok: false as const, error: "Bot not found", run: null };
    if (bot.status === "RUNNING") return { ok: false as const, error: "Bot is already running", run: null };
    const version = await this.strategies.findVersionById(bot.strategyVersionId);
    if (!version) return { ok: false as const, error: "Strategy version not found", run: null };
    if (bot.mode === "BACKTEST" && (!range || range.from >= range.to)) {
      return { ok: false as const, error: "A valid backtest range is required", run: null };
    }

    const run: BotRun = {
      id: randomUUID(), botId: bot.id, mode: bot.mode, status: "RUNNING",
      configurationSnapshot: { ...bot, createdAt: bot.createdAt.toISOString(), updatedAt: bot.updatedAt.toISOString() },
      strategySnapshot: version,
      backtestFrom: range?.from ?? null, backtestTo: range?.to ?? null,
      startedAt: new Date(), endedAt: null, errorMessage: null,
    };
    await this.runs.save(run);
    await this.bots.save({ ...bot, status: "RUNNING", updatedAt: new Date() });
    return { ok: true as const, error: "", run };
  }
}
