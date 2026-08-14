import { CreateBotUseCase, GetBotUseCase, ListBotsUseCase, SetBotStatusUseCase, StartBotUseCase, UpdateBotUseCase } from "@/src/modules/bot";
import type { BotRepository, BotRunRepository } from "@/src/modules/bot";
import type { BotLifecycleRepository } from "@/src/modules/bot";
import { ListCandlesUseCase, SaveCandlesUseCase } from "@/src/modules/market";
import type { CandleRepository } from "@/src/modules/market";
import { ActivateStrategyVersionUseCase, AddStrategyVersionUseCase, CreateStrategyUseCase,
  EvaluateStrategyForClosedCandleUseCase, ListStrategiesUseCase } from "@/src/modules/strategy";
import type { ClosedCandleHistoryRepository, StrategyEvaluationRepository, StrategyRepository } from "@/src/modules/strategy";
import type { PairRepository } from "@/src/modules/pair";

export type TradingBotRepositories = {
  botRepository: BotRepository;
  botRunRepository: BotRunRepository;
  candleRepository: CandleRepository & ClosedCandleHistoryRepository;
  strategyRepository: StrategyRepository;
  strategyEvaluationRepository: StrategyEvaluationRepository;
  botLifecycleRepository?: BotLifecycleRepository;
  pairRepository: PairRepository;
};

export function createTradingBotUseCases(repositories: TradingBotRepositories) {
  return {
    createBot: new CreateBotUseCase(repositories.botRepository, async (id) => {
      const version = await repositories.strategyRepository.findVersionById(id);
      if (!version) return null;
      return (await repositories.strategyRepository.findById(version.strategyId))?.userId ?? null;
    }, async (symbol) => Boolean(await repositories.pairRepository.findBySymbol(symbol))),
    getBot: new GetBotUseCase(repositories.botRepository),
    updateBot: new UpdateBotUseCase(repositories.botRepository, async (id) => {
      const version = await repositories.strategyRepository.findVersionById(id);
      if (!version) return null;
      return (await repositories.strategyRepository.findById(version.strategyId))?.userId ?? null;
    }, async (symbol) => Boolean(await repositories.pairRepository.findBySymbol(symbol))),
    listBots: new ListBotsUseCase(repositories.botRepository),
    startBot: new StartBotUseCase(repositories.botRepository, repositories.botRunRepository, repositories.strategyRepository, repositories.botLifecycleRepository),
    setBotStatus: new SetBotStatusUseCase(repositories.botRepository, repositories.botLifecycleRepository),
    createStrategy: new CreateStrategyUseCase(repositories.strategyRepository),
    addStrategyVersion: new AddStrategyVersionUseCase(repositories.strategyRepository),
    activateStrategyVersion: new ActivateStrategyVersionUseCase(repositories.botRepository, repositories.strategyRepository),
    listStrategies: new ListStrategiesUseCase(repositories.strategyRepository),
    saveCandles: new SaveCandlesUseCase(repositories.candleRepository),
    listCandles: new ListCandlesUseCase(repositories.candleRepository),
    evaluateStrategyForClosedCandle: new EvaluateStrategyForClosedCandleUseCase(
      repositories.botRunRepository,
      repositories.candleRepository,
      repositories.strategyEvaluationRepository,
    ),
  } as const;
}
