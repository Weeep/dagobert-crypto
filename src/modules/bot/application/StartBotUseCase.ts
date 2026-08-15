import { randomUUID } from "node:crypto";
import { validateStrategyDefinition, type StrategyRepository } from "@/src/modules/strategy";
import type { BotRepository } from "../domain/BotRepository";
import type { BotRunRepository } from "../domain/BotRunRepository";
import type { BotRun } from "../domain/TradingBot";
import type { BotLifecycleRepository } from "../domain/BotLifecycleRepository";

export class StartBotUseCase {
  constructor(
    private readonly bots: BotRepository,
    private readonly runs: BotRunRepository,
    private readonly strategies: StrategyRepository,
    private readonly lifecycle?: BotLifecycleRepository
  ) {}

  async execute(botId: string, range?: { from: Date; to: Date }) {
    const bot = await this.bots.findById(botId);
    if (!bot) return { ok: false as const, error: "Bot not found", run: null };
    if (bot.archivedAt) return { ok: false as const, error: "Archived bot cannot be started", run: null };
    if (bot.status === "RUNNING") {
      const activeRun = (await this.runs.findAllByBotId(bot.id)).find((candidate) => candidate.status === "RUNNING");
      return activeRun
        ? { ok: true as const, error: "", run: activeRun }
        : { ok: false as const, error: "Running bot has no active run", run: null };
    }
    if (bot.status === "STOPPED" || (bot.status === "ERROR" && bot.mode !== "BACKTEST"))
      return { ok: false as const, error: `Cannot start ${bot.status} bot`, run: null };
    const version = await this.strategies.findVersionById(bot.strategyVersionId);
    if (!version) return { ok: false as const, error: "Strategy version not found", run: null };
    const validatedStrategy = validateStrategyDefinition(version.definition, version.schemaVersion);
    if (!validatedStrategy.ok) return { ok: false as const, error: "Strategy version is invalid or unsupported", run: null };
    if (bot.mode === "BACKTEST" && (!range || !this.isValidDate(range.from) || !this.isValidDate(range.to) || range.from >= range.to)) {
      return { ok: false as const, error: "A valid backtest range is required", run: null };
    }

    const run: BotRun = {
      id: randomUUID(), botId: bot.id, mode: bot.mode, status: "RUNNING",
      configurationSnapshot: structuredClone({ ...bot, createdAt: bot.createdAt.toISOString(), updatedAt: bot.updatedAt.toISOString() }),
      strategySnapshot: structuredClone({ ...version, definition: validatedStrategy.definition, createdAt: version.createdAt.toISOString() }),
      backtestFrom: range?.from ?? null, backtestTo: range?.to ?? null,
      startedAt: new Date(), endedAt: null, errorMessage: null,
    };
    if (this.lifecycle) {
      if (!await this.lifecycle.start(bot, run)) return { ok: false as const, error: "Bot lifecycle changed concurrently", run: null };
    } else {
      await this.runs.save(run);
      await this.bots.save({ ...bot, status: "RUNNING", updatedAt: new Date() });
    }
    return { ok: true as const, error: "", run };
  }

  private isValidDate(value: Date): boolean {
    return value instanceof Date && !Number.isNaN(value.getTime());
  }
}
