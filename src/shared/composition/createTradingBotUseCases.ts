import { CreateBotUseCase, DeleteBotUseCase, GetBotErrorUseCase, GetBotUseCase, ListBotsUseCase, RunBacktestUseCase,
  SetBotStatusUseCase, StartBotUseCase, UpdateBotUseCase } from "@/src/modules/bot";
import type { BotRepository, BotRunRepository } from "@/src/modules/bot";
import type { BacktestRunPersistenceRepository, BotLifecycleRepository } from "@/src/modules/bot";
import { ListCandlesUseCase, SaveCandlesUseCase } from "@/src/modules/market";
import type { CandleRepository } from "@/src/modules/market";
import { ActivateStrategyVersionUseCase, AddStrategyVersionUseCase, CreateStrategyUseCase,
  EvaluateStrategyForClosedCandleUseCase, GetStrategyUseCase, GetStrategyVersionUseCase,
  ListStrategiesUseCase, ValidateStrategyDefinitionUseCase } from "@/src/modules/strategy";
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
  backtestRunPersistenceRepository: BacktestRunPersistenceRepository;
};

export function createTradingBotUseCases(repositories: TradingBotRepositories) {
  const startBot = new StartBotUseCase(repositories.botRepository, repositories.botRunRepository,
    repositories.strategyRepository, repositories.botLifecycleRepository);
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
    deleteBot: new DeleteBotUseCase(repositories.botRepository),
    getBotError: new GetBotErrorUseCase(repositories.botRepository, repositories.botRunRepository),
    startBot,
    runBacktest: new RunBacktestUseCase(repositories.botRepository, repositories.strategyRepository,
      repositories.candleRepository, startBot, repositories.backtestRunPersistenceRepository),
    setBotStatus: new SetBotStatusUseCase(repositories.botRepository, repositories.botLifecycleRepository),
    createStrategy: new CreateStrategyUseCase(repositories.strategyRepository),
    addStrategyVersion: new AddStrategyVersionUseCase(repositories.strategyRepository),
    activateStrategyVersion: new ActivateStrategyVersionUseCase(repositories.botRepository, repositories.strategyRepository),
    listStrategies: new ListStrategiesUseCase(repositories.strategyRepository),
    getStrategy: new GetStrategyUseCase(repositories.strategyRepository),
    getStrategyVersion: new GetStrategyVersionUseCase(repositories.strategyRepository),
    validateStrategyDefinition: new ValidateStrategyDefinitionUseCase(),
    saveCandles: new SaveCandlesUseCase(repositories.candleRepository),
    listCandles: new ListCandlesUseCase(repositories.candleRepository),
    evaluateStrategyForClosedCandle: new EvaluateStrategyForClosedCandleUseCase(
      repositories.botRunRepository,
      repositories.candleRepository,
      repositories.strategyEvaluationRepository,
    ),
  } as const;
}
