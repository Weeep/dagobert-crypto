export type { Strategy, StrategyVersion } from "./domain/Strategy";
export type { StrategyRepository } from "./domain/StrategyRepository";
export type { StrategyDto } from "./dto/StrategyDto";
export { toStrategyDto } from "./dto/StrategyDto";
export { CreateStrategyUseCase } from "./application/CreateStrategyUseCase";
export type { CreateStrategyInput } from "./application/CreateStrategyUseCase";
export { AddStrategyVersionUseCase } from "./application/AddStrategyVersionUseCase";
export { ActivateStrategyVersionUseCase } from "./application/ActivateStrategyVersionUseCase";
export { calculateEma, calculateRsi, createHistoricalIndicatorCache } from "./domain/TechnicalIndicators";
export type { HistoricalIndicatorCache, IndicatorPrice } from "./domain/TechnicalIndicators";
export {
  calculateCandleBodyChangePct,
  classifyCandleDirection,
  matchesCandleSequence,
} from "./domain/CandleFacts";
export type { CandleDirection, CandlePrice, CandleSequenceRule } from "./domain/CandleFacts";
export {
  MAX_STRATEGY_DEPTH,
  MAX_STRATEGY_NODES,
  STRATEGY_SCHEMA_VERSION,
  validateStrategyDefinition,
} from "./domain/StrategyDefinition";
export type {
  ComparisonOperator,
  EmaDistanceCondition,
  EmaPosition,
  EntryPolicy,
  EntryTrigger,
  StrategyCondition,
  StrategyDefinitionV1,
  StrategyValidationIssue,
  StrategyValidationResult,
} from "./domain/StrategyDefinition";
export { STRATEGY_DEFINITION_V1_JSON_SCHEMA } from "./domain/StrategyDefinitionSchema";
export { evaluateCondition } from "./domain/ConditionEvaluator";
export type {
  ConditionEvaluation,
  ConditionEvaluationContext,
  ConditionObservedValues,
} from "./domain/ConditionEvaluator";
export { evaluateStrategy, evaluateValidatedHistoricalStrategy, StrategyEngineInputError } from "./domain/StrategyEngine";
export type {
  StrategyAction,
  StrategyEngineInput,
  StrategyEvaluation,
  StrategyPositionContext,
} from "./domain/StrategyEngine";
export type {
  ClosedCandleHistoryRepository,
  PersistedStrategyEvaluation,
  StrategyEvaluationRepository,
} from "./domain/StrategyEvaluationRepository";
export { EvaluateStrategyForClosedCandleUseCase } from "./application/EvaluateStrategyForClosedCandleUseCase";
export { requiredCandles } from "./application/EvaluateStrategyForClosedCandleUseCase";
export { ListStrategiesUseCase } from "./application/ListStrategiesUseCase";
export { GetStrategyUseCase } from "./application/GetStrategyUseCase";
export { GetStrategyVersionUseCase } from "./application/GetStrategyVersionUseCase";
export { ValidateStrategyDefinitionUseCase } from "./application/ValidateStrategyDefinitionUseCase";
