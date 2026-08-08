import type { BotRepository } from "../domain/BotRepository";
import type { BotStatus } from "../domain/TradingBot";
import type { BotLifecycleRepository } from "../domain/BotLifecycleRepository";

export class SetBotStatusUseCase {
  constructor(private readonly repository: BotRepository, private readonly lifecycle?: BotLifecycleRepository) {}
  async execute(id: string, status: Extract<BotStatus, "PAUSED" | "STOPPED">) {
    const bot = await this.repository.findById(id);
    if (!bot) return { ok: false as const, error: "Bot not found", bot: null };
    if (bot.status === status) return { ok: true as const, error: "", bot };
    if (bot.status !== "RUNNING" && !(bot.status === "PAUSED" && status === "STOPPED")) {
      return { ok: false as const, error: `Cannot change ${bot.status} bot to ${status}`, bot: null };
    }
    if (this.lifecycle) {
      const updated = await this.lifecycle.transition(id, status);
      return updated ? { ok: true as const, error: "", bot: updated } : { ok: false as const, error: "Bot lifecycle changed concurrently", bot: null };
    }
    const updated = { ...bot, status, updatedAt: new Date() };
    await this.repository.save(updated);
    return { ok: true as const, error: "", bot: updated };
  }
}
