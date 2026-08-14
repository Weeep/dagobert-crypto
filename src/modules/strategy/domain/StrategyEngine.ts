import type { Candle } from "@/src/modules/market";
import { evaluateCondition, type ConditionEvaluation } from "./ConditionEvaluator";
import { validateStrategyDefinition, type StrategyDefinitionV1 } from "./StrategyDefinition";

export type StrategyAction = "BUY" | "SELL" | "HOLD";
export type StrategyPositionContext = { hasOpenPositions: boolean; openPositionCount: number };
export type StrategyEngineInput = {
  definition: StrategyDefinitionV1;
  candles: readonly Candle[];
  evaluatedCandle: Candle;
  position: StrategyPositionContext;
};
export type StrategyEvaluation = {
  action: StrategyAction;
  reasonCode: string;
  explanation: string;
  policyReasons: string[];
  evaluatedCandleId: string;
  evaluatedCandleOpenTime: Date;
  position: StrategyPositionContext;
  exit: ConditionEvaluation;
  entry: ConditionEvaluation;
};

export class StrategyEngineInputError extends Error {
  constructor(message: string) { super(message); this.name = "StrategyEngineInputError"; }
}

function validateInput(input: StrategyEngineInput): void {
  if (!validateStrategyDefinition(input.definition).ok)
    throw new StrategyEngineInputError("strategy definition is invalid or unsupported");
  if (!Number.isSafeInteger(input.position.openPositionCount) || input.position.openPositionCount < 0)
    throw new StrategyEngineInputError("openPositionCount must be a non-negative safe integer");
  if (input.position.hasOpenPositions !== (input.position.openPositionCount > 0))
    throw new StrategyEngineInputError("position context is inconsistent");
  if (input.candles.length === 0) throw new StrategyEngineInputError("candle history is required");
  if (!input.evaluatedCandle.isClosed) throw new StrategyEngineInputError("evaluated candle must be closed");
  if (!Number.isFinite(input.evaluatedCandle.openTime.getTime()) || !Number.isFinite(input.evaluatedCandle.closeTime.getTime()))
    throw new StrategyEngineInputError("evaluated candle timestamps must be valid");

  let previousOpenTime = Number.NEGATIVE_INFINITY;
  let evaluatedOccurrences = 0;
  const candleIds = new Set<string>();
  for (const candle of input.candles) {
    if (!candle.isClosed) throw new StrategyEngineInputError("candle history cannot contain an open candle");
    if (candle.pairSymbol !== input.evaluatedCandle.pairSymbol || candle.interval !== input.evaluatedCandle.interval)
      throw new StrategyEngineInputError("all candles must use the evaluated candle symbol and interval");
    const openTime = candle.openTime.getTime();
    const closeTime = candle.closeTime.getTime();
    if (!Number.isFinite(openTime) || !Number.isFinite(closeTime) || closeTime < openTime)
      throw new StrategyEngineInputError("candle history timestamps must be valid");
    if (openTime <= previousOpenTime)
      throw new StrategyEngineInputError("candle history must be strictly ordered without duplicate open times");
    if (candleIds.has(candle.id)) throw new StrategyEngineInputError("candle history cannot contain duplicate ids");
    candleIds.add(candle.id);
    if (openTime > input.evaluatedCandle.openTime.getTime() || closeTime > input.evaluatedCandle.closeTime.getTime())
      throw new StrategyEngineInputError("candle history cannot contain a future candle");
    if (candle.id === input.evaluatedCandle.id) evaluatedOccurrences += 1;
    previousOpenTime = openTime;
  }
  const latest = input.candles.at(-1)!;
  if (evaluatedOccurrences !== 1 || latest.id !== input.evaluatedCandle.id ||
      latest.openTime.getTime() !== input.evaluatedCandle.openTime.getTime() ||
      latest.closeTime.getTime() !== input.evaluatedCandle.closeTime.getTime() ||
      latest.open !== input.evaluatedCandle.open || latest.high !== input.evaluatedCandle.high ||
      latest.low !== input.evaluatedCandle.low || latest.close !== input.evaluatedCandle.close)
    throw new StrategyEngineInputError("evaluated candle must be the final unique candle in history");
}

/** Produces a deterministic intent only; risk validation and execution remain downstream. */
export function evaluateStrategy(input: StrategyEngineInput): StrategyEvaluation {
  validateInput(input);
  const context = { candles: input.candles };
  const exit = evaluateCondition(input.definition.exit, context);
  const entry = evaluateCondition(input.definition.entry, context);
  const policyReasons: string[] = [];

  let action: StrategyAction;
  let reasonCode: string;
  let explanation: string;
  if (exit.matched && input.position.hasOpenPositions) {
    action = "SELL"; reasonCode = "EXIT_MATCHED";
    explanation = "Exit matched and has priority while positions are open";
  } else {
    if (exit.matched) policyReasons.push("EXIT_MATCHED_NO_OPEN_POSITION");
    if (entry.matched) {
      action = "BUY";
      reasonCode = exit.matched ? "ENTRY_MATCHED_AFTER_NON_ACTIONABLE_EXIT" : "ENTRY_MATCHED";
      explanation = exit.matched
        ? "Exit matched without an open position; entry matched and is actionable"
        : "Entry matched and no actionable exit has priority";
    } else {
      action = "HOLD";
      reasonCode = exit.matched ? "EXIT_MATCHED_NO_OPEN_POSITION" : "NO_ACTIONABLE_CONDITION";
      explanation = exit.matched
        ? "Exit matched but there is no open position and entry did not match"
        : "Neither an actionable exit nor entry matched";
    }
  }
  if (!policyReasons.includes(reasonCode)) policyReasons.push(reasonCode);
  return {
    action, reasonCode, explanation, policyReasons,
    evaluatedCandleId: input.evaluatedCandle.id,
    evaluatedCandleOpenTime: new Date(input.evaluatedCandle.openTime),
    position: { ...input.position }, exit, entry,
  };
}
