import type { BotRun } from "./TradingBot";

export interface BotRunRepository {
  findById(id: string): Promise<BotRun | null>;
  findAllByBotId(botId: string): Promise<BotRun[]>;
  save(run: BotRun): Promise<void>;
}
