import type { BotRepository } from "../domain/BotRepository";
import type { BotRunRepository } from "../domain/BotRunRepository";

export class GetBotErrorUseCase {
  constructor(private readonly bots: BotRepository, private readonly runs: BotRunRepository) {}

  async execute(userId: string, botId: string) {
    const bot = await this.bots.findById(botId);
    if (!bot || bot.userId !== userId) return { found: false as const, error: null };
    const run = (await this.runs.findAllByBotId(botId))
      .filter((candidate) => candidate.status === "ERROR" && candidate.errorMessage?.trim())
      .sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime())[0];
    return { found: true as const, error: run ? {
      runId: run.id, message: run.errorMessage!, occurredAt: (run.endedAt ?? run.startedAt).toISOString(),
    } : null };
  }
}
