import type { TradingBot } from "./TradingBot";

export interface BotRepository {
  findAllByUserId(userId: string): Promise<TradingBot[]>;
  findById(id: string): Promise<TradingBot | null>;
  findByUserIdAndName(userId: string, name: string): Promise<TradingBot | null>;
  save(bot: TradingBot): Promise<void>;
  delete(id: string): Promise<void>;
}
