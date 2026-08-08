import type { BotRun, BotStatus, TradingBot } from "./TradingBot";
export interface BotLifecycleRepository {
  start(bot: TradingBot, run: BotRun): Promise<boolean>;
  transition(botId: string, status: Extract<BotStatus, "PAUSED" | "STOPPED">): Promise<TradingBot | null>;
}
