import { CreateBotUseCase, ListBotsUseCase, SetBotStatusUseCase, StartBotUseCase } from "@/src/modules/bot";
import type { BotRepository, BotRunRepository } from "@/src/modules/bot";
import { ListCandlesUseCase, SaveCandlesUseCase } from "@/src/modules/market";
import type { CandleRepository } from "@/src/modules/market";
import { AddStrategyVersionUseCase, CreateStrategyUseCase, ListStrategiesUseCase } from "@/src/modules/strategy";
import type { StrategyRepository } from "@/src/modules/strategy";

export type TradingBotRepositories = {
  botRepository: BotRepository;
  botRunRepository: BotRunRepository;
  candleRepository: CandleRepository;
  strategyRepository: StrategyRepository;
};

export function createTradingBotUseCases(repositories: TradingBotRepositories) {
  return {
    createBot: new CreateBotUseCase(repositories.botRepository),
    listBots: new ListBotsUseCase(repositories.botRepository),
    startBot: new StartBotUseCase(repositories.botRepository, repositories.botRunRepository, repositories.strategyRepository),
    setBotStatus: new SetBotStatusUseCase(repositories.botRepository),
    createStrategy: new CreateStrategyUseCase(repositories.strategyRepository),
    addStrategyVersion: new AddStrategyVersionUseCase(repositories.strategyRepository),
    listStrategies: new ListStrategiesUseCase(repositories.strategyRepository),
    saveCandles: new SaveCandlesUseCase(repositories.candleRepository),
    listCandles: new ListCandlesUseCase(repositories.candleRepository),
  } as const;
}
