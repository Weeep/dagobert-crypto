import type { BotRepository } from "@/src/modules/bot";
import type { StrategyRepository } from "../domain/StrategyRepository";
import { validateStrategyDefinition } from "../domain/StrategyDefinition";

export class ActivateStrategyVersionUseCase {
  constructor(private readonly bots: BotRepository, private readonly strategies: StrategyRepository) {}

  async execute(userId: string, botId: string, strategyVersionId: string) {
    const bot = await this.bots.findById(botId);
    if (!bot || bot.userId !== userId)
      return { ok: false as const, error: "Bot not found", bot: null };
    if (bot.status === "RUNNING")
      return { ok: false as const, error: "Running bot strategy cannot be changed", bot: null };
    const version = await this.strategies.findVersionById(strategyVersionId);
    if (!version) return { ok: false as const, error: "Strategy version not found", bot: null };
    const strategy = await this.strategies.findById(version.strategyId);
    if (!strategy || strategy.userId !== userId)
      return { ok: false as const, error: "Strategy version not found", bot: null };
    if (!validateStrategyDefinition(version.definition, version.schemaVersion).ok)
      return { ok: false as const, error: "Strategy version is invalid or unsupported", bot: null };
    const activated = { ...bot, strategyVersionId, updatedAt: new Date() };
    await this.bots.save(activated);
    return { ok: true as const, error: "", bot: activated };
  }
}
