import type { BotRepository } from "../domain/BotRepository";

export class DeleteBotUseCase {
  constructor(private readonly bots: BotRepository) {}
  async execute(userId: string, id: string) {
    const bot = await this.bots.findById(id);
    if (!bot || bot.userId !== userId) return { ok: false as const, error: "Bot not found" };
    if (!await this.bots.deleteIfNotRunning(id, userId))
      return { ok: false as const, error: "Running bot cannot be deleted" };
    return { ok: true as const, error: "" };
  }
}
