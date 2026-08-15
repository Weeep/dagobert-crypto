import type { TradingBot } from "./TradingBot";

export interface BotRepository {
  findAllByUserId(userId: string): Promise<TradingBot[]>;
  findById(id: string): Promise<TradingBot | null>;
  findByUserIdAndName(userId: string, name: string): Promise<TradingBot | null>;
  save(bot: TradingBot): Promise<void>;
  /** Atomically deletes only if the owned bot is still non-running. */
  deleteIfNotRunning(id: string, userId: string): Promise<boolean>;
}
