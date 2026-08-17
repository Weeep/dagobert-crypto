import Big from "big.js";
import type { Candle } from "@/src/modules/market";
import { calculateEma, calculateRsi, type HistoricalIndicatorCache } from "./TechnicalIndicators";
import {
  calculateCandleBodyChangePct,
  classifyCandleDirection,
  matchesCandleSequence,
} from "./CandleFacts";
import type { ComparisonOperator, StrategyCondition } from "./StrategyDefinition";
import type { StrategyPositionLotContext } from "./StrategyEngine";

export type ConditionObservedValues = Record<string, string | number | boolean | null | string[]>;
export type ConditionEvaluation = {
  type: "ALL" | "ANY" | "RSI" | "EMA_DISTANCE" | "EMA_DEVIATION_PCT" | "EMA_CROSS_CONFIRMATION" | "MARKET_REGIME" | "EMA_SLOPE" | "CANDLE_SEQUENCE" | "POSITION_RETURN_PCT";
  matched: boolean;
  reasonCode: string;
  explanation: string;
  observedValues: ConditionObservedValues;
  children: ConditionEvaluation[];
};

export type ConditionEvaluationContext = {
  candles: readonly Candle[];
  /** Inclusive candle index used by validated historical evaluation. */
  endIndex?: number;
  indicatorCache?: HistoricalIndicatorCache;
  position?: StrategyPositionLotContext;
  exitFeeRate?: string;
};

const endIndex = (context: ConditionEvaluationContext) => context.endIndex ?? context.candles.length - 1;
const availableCandles = (context: ConditionEvaluationContext) => endIndex(context) + 1;
const latestCandle = (context: ConditionEvaluationContext) => context.candles[endIndex(context)];
const trailingCandles = (context: ConditionEvaluationContext, count: number) => {
  const end = endIndex(context) + 1;
  return context.candles.slice(Math.max(0, end - count), end);
};
const historicalCandles = (context: ConditionEvaluationContext) =>
  context.endIndex === undefined ? context.candles : context.candles.slice(0, endIndex(context) + 1);

function compare(observed: number | string, expected: number, operator: ComparisonOperator): boolean {
  const left = new Big(observed);
  const right = new Big(expected);
  if (operator === "LT") return left.lt(right);
  if (operator === "LTE") return left.lte(right);
  if (operator === "GT") return left.gt(right);
  return left.gte(right);
}

const insufficient = (type: ConditionEvaluation["type"], required: number, available: number): ConditionEvaluation => ({
  type,
  matched: false,
  reasonCode: "INSUFFICIENT_HISTORY",
  explanation: `${type} requires ${required} closed candles, but only ${available} are available`,
  observedValues: { requiredCandles: required, availableCandles: available, observed: null },
  children: [],
});

function evaluateNode(
  condition: StrategyCondition,
  context: ConditionEvaluationContext,
): ConditionEvaluation {
  if ("all" in condition || "any" in condition) {
    const type = "all" in condition ? "ALL" : "ANY";
    const conditions = "all" in condition ? condition.all : condition.any;
    const children = conditions.map((child) => evaluateNode(child, context));
    const matched = type === "ALL" ? children.every((child) => child.matched) : children.some((child) => child.matched);
    return {
      type,
      matched,
      reasonCode: `${type}_${matched ? "MATCHED" : "NOT_MATCHED"}`,
      explanation: `${type} group ${matched ? "matched" : "did not match"} (${children.filter((child) => child.matched).length}/${children.length})`,
      observedValues: { matchedChildren: children.filter((child) => child.matched).length, totalChildren: children.length },
      children,
    };
  }

  if ("indicator" in condition && condition.indicator === "RSI") {
    const required = condition.period + 1;
    const observed = context.indicatorCache
      ? context.indicatorCache.rsi(condition.period, endIndex(context))
      : calculateRsi(historicalCandles(context), condition.period);
    if (observed === null) return insufficient("RSI", required, availableCandles(context));
    const matched = compare(observed, condition.value, condition.operator);
    return {
      type: "RSI", matched, reasonCode: `RSI_${matched ? "MATCHED" : "NOT_MATCHED"}`,
      explanation: `RSI(${condition.period}) ${observed} ${matched ? "matched" : "did not match"} ${condition.operator} ${condition.value}`,
      observedValues: { indicator: "RSI", period: condition.period, operator: condition.operator,
        expected: condition.value, observed }, children: [],
    };
  }

  if ("indicator" in condition && condition.indicator === "POSITION_RETURN_PCT") {
    if (!context.position || context.exitFeeRate === undefined) return {
      type: "POSITION_RETURN_PCT", matched: false, reasonCode: "POSITION_CONTEXT_REQUIRED",
      explanation: "POSITION_RETURN_PCT requires an open position lot and exit fee rate",
      observedValues: { observed: null, operator: condition.operator, expected: condition.value }, children: [],
    };
    const close = new Big(latestCandle(context).close);
    const quantity = new Big(context.position.quantity);
    const entryCost = new Big(context.position.entryCost);
    const entryFees = new Big(context.position.entryFees);
    const entryOutflow = entryCost.plus(entryFees);
    if (entryOutflow.lte(0)) throw new Error("POSITION_RETURN_PCT requires positive fee-inclusive entry cost");
    const grossExitValue = quantity.times(close);
    const estimatedExitFee = grossExitValue.times(context.exitFeeRate);
    const netExitProceeds = grossExitValue.minus(estimatedExitFee);
    const netReturnPct = netExitProceeds.minus(entryOutflow).div(entryOutflow).times(100);
    const matched = compare(netReturnPct.toString(), condition.value, condition.operator);
    return {
      type: "POSITION_RETURN_PCT", matched,
      reasonCode: `POSITION_RETURN_PCT_${matched ? "MATCHED" : "NOT_MATCHED"}`,
      explanation: `Position ${context.position.id} net return ${netReturnPct.toString()}% ${matched ? "matched" : "did not match"} ${condition.operator} ${condition.value}%`,
      observedValues: { indicator: "POSITION_RETURN_PCT", positionId: context.position.id,
        operator: condition.operator, expected: condition.value, observed: netReturnPct.toString(),
        close: close.toString(), quantity: quantity.toString(), entryCost: entryCost.toString(),
        entryFees: entryFees.toString(), grossExitValue: grossExitValue.toString(),
        estimatedExitFee: estimatedExitFee.toString(), netExitProceeds: netExitProceeds.toString(),
        exitFeeRate: context.exitFeeRate }, children: [],
    };
  }

  if ("indicator" in condition && condition.indicator === "EMA_CROSS_CONFIRMATION") {
    const required = condition.period + condition.confirmationCandles;
    if (availableCandles(context) < required)
      return insufficient("EMA_CROSS_CONFIRMATION", required, availableCandles(context));
    // Use the same bounded input in live evaluation and backtests. Live runs load
    // exactly `required` candles, while backtests pass the complete prefix.
    const calculationCandles = trailingCandles(context, required);
    const firstIndex = calculationCandles.length - condition.confirmationCandles - 1;
    const selected = calculationCandles.slice(firstIndex);
    const emas = selected.map((_, index) =>
      calculateEma(calculationCandles.slice(0, firstIndex + index + 1), condition.period)!);
    const closes = selected.map((candle) => new Big(candle.close));
    const confirmedSides = closes.slice(1).map((close, index) => condition.direction === "ABOVE"
      ? close.gt(emas[index + 1]) : close.lt(emas[index + 1]));
    const previousOnOppositeSide = condition.direction === "ABOVE"
      ? closes[0].lte(emas[0]) : closes[0].gte(emas[0]);
    const matched = previousOnOppositeSide && confirmedSides.every(Boolean);
    return {
      type: "EMA_CROSS_CONFIRMATION", matched,
      reasonCode: `EMA_CROSS_CONFIRMATION_${matched ? "MATCHED" : "NOT_MATCHED"}`,
      explanation: `EMA(${condition.period}) ${condition.direction} crossing ${matched ? "was" : "was not"} confirmed by ${condition.confirmationCandles} candles`,
      observedValues: { indicator: "EMA_CROSS_CONFIRMATION", period: condition.period,
        direction: condition.direction, confirmationCandles: condition.confirmationCandles,
        closes: closes.map(String), emas: emas.map(String), previousOnOppositeSide,
        confirmedSides: confirmedSides.map(String) }, children: [],
    };
  }

  if ("indicator" in condition && condition.indicator === "MARKET_REGIME") {
    const periods = [7, 25, 100] as const;
    const emas = periods.map((period) => context.indicatorCache
      ? context.indicatorCache.ema(period, endIndex(context))
      : calculateEma(historicalCandles(context), period));
    if (emas.some((ema) => ema === null)) return insufficient("MARKET_REGIME", 100, availableCandles(context));
    const [ema7, ema25, ema100] = emas as [number, number, number];
    const observed = ema7 > ema25 && ema25 > ema100 ? "BULLISH"
      : ema7 < ema25 && ema25 < ema100 ? "BEARISH" : "SIDEWAYS";
    const matched = observed === condition.value;
    return { type: "MARKET_REGIME", matched,
      reasonCode: `MARKET_REGIME_${matched ? "MATCHED" : "NOT_MATCHED"}`,
      explanation: `Market regime was ${observed} and ${matched ? "matched" : "did not match"} ${condition.value}`,
      observedValues: { indicator: "MARKET_REGIME", expected: condition.value, observed, ema7, ema25, ema100 },
      children: [] };
  }

  if ("indicator" in condition && condition.indicator === "EMA_SLOPE") {
    const required = condition.period + condition.lookbackCandles;
    if (availableCandles(context) < required) return insufficient("EMA_SLOPE", required, availableCandles(context));
    const currentIndex = endIndex(context);
    const previousIndex = currentIndex - condition.lookbackCandles;
    const currentEma = context.indicatorCache?.ema(condition.period, currentIndex)
      ?? calculateEma(historicalCandles(context), condition.period);
    const previousEma = context.indicatorCache?.ema(condition.period, previousIndex)
      ?? calculateEma(historicalCandles(context).slice(0, previousIndex + 1), condition.period);
    if (currentEma === null || previousEma === null) return insufficient("EMA_SLOPE", required, availableCandles(context));
    const slopePct = new Big(previousEma).eq(0) ? null
      : new Big(currentEma).minus(previousEma).div(previousEma).times(100).toString();
    const matched = slopePct !== null && compare(slopePct, condition.value, condition.operator);
    return { type: "EMA_SLOPE", matched, reasonCode: `EMA_SLOPE_${matched ? "MATCHED" : "NOT_MATCHED"}`,
      explanation: `EMA(${condition.period}) changed ${slopePct ?? "undefined"}% over ${condition.lookbackCandles} candles and ${matched ? "matched" : "did not match"} ${condition.operator} ${condition.value}%`,
      observedValues: { indicator: "EMA_SLOPE", period: condition.period,
        lookbackCandles: condition.lookbackCandles, operator: condition.operator, expected: condition.value,
        observed: slopePct, previousEma, currentEma }, children: [] };
  }

  if ("indicator" in condition && condition.indicator === "EMA_DEVIATION_PCT") {
    const observedEma = context.indicatorCache
      ? context.indicatorCache.ema(condition.period, endIndex(context))
      : calculateEma(historicalCandles(context), condition.period);
    if (observedEma === null) return insufficient("EMA_DEVIATION_PCT", condition.period, availableCandles(context));
    const close = new Big(latestCandle(context).close);
    const ema = new Big(observedEma);
    const deviationPct = ema.eq(0) ? null : close.minus(ema).div(ema).times(100);
    const matched = deviationPct !== null && compare(deviationPct.toString(), condition.value, condition.operator);
    const observed = deviationPct?.toString() ?? null;
    return {
      type: "EMA_DEVIATION_PCT", matched,
      reasonCode: `EMA_DEVIATION_PCT_${matched ? "MATCHED" : "NOT_MATCHED"}`,
      explanation: `Close deviation from EMA(${condition.period}) was ${observed ?? "undefined"}% and ${matched ? "matched" : "did not match"} ${condition.operator} ${condition.value}%`,
      observedValues: { indicator: "EMA_DEVIATION_PCT", period: condition.period,
        operator: condition.operator, expected: condition.value, observed, close: close.toString(), ema: observedEma },
      children: [],
    };
  }

  if ("indicator" in condition) {
    const observedEma = context.indicatorCache
      ? context.indicatorCache.ema(condition.period, endIndex(context))
      : calculateEma(historicalCandles(context), condition.period);
    if (observedEma === null) return insufficient("EMA_DISTANCE", condition.period, availableCandles(context));
    const close = new Big(latestCandle(context).close);
    const ema = new Big(observedEma);
    const distancePct = ema.eq(0) ? null : Number(close.minus(ema).abs().div(ema).times(100));
    const sideMatched = condition.position === "ABOVE" ? close.gt(ema) : close.lt(ema);
    const distanceMatched = condition.maximumDistancePct === undefined ||
      (distancePct !== null && new Big(distancePct).lte(condition.maximumDistancePct));
    const matched = sideMatched && distanceMatched;
    const distanceExplanation = condition.maximumDistancePct === undefined
      ? "with any distance"
      : `within ${condition.maximumDistancePct}% (observed ${distancePct ?? "undefined"}%)`;
    return {
      type: "EMA_DISTANCE", matched,
      reasonCode: `EMA_DISTANCE_${matched ? "MATCHED" : "NOT_MATCHED"}`,
      explanation: `Close ${close.toString()} ${matched ? "matched" : "did not match"} ${condition.position} EMA(${condition.period}) ${observedEma} ${distanceExplanation}`,
      observedValues: { indicator: "EMA_DISTANCE", period: condition.period, position: condition.position,
        maximumDistancePct: condition.maximumDistancePct ?? null, close: close.toString(), ema: observedEma,
        sideMatched, distanceMatched, distancePct }, children: [],
    };
  }

  const rule = condition.candleSequence;
  if (availableCandles(context) < rule.count)
    return insufficient("CANDLE_SEQUENCE", rule.count, availableCandles(context));
  const selected = trailingCandles(context, rule.count);
  const matched = matchesCandleSequence(selected, rule);
  return {
    type: "CANDLE_SEQUENCE", matched,
    reasonCode: `CANDLE_SEQUENCE_${matched ? "MATCHED" : "NOT_MATCHED"}`,
    explanation: `Last ${rule.count} candles ${matched ? "matched" : "did not match"} ${rule.direction} with minimum ${rule.minimumBodyChangePct}% body change`,
    observedValues: {
      count: rule.count,
      expectedDirection: rule.direction,
      minimumBodyChangePct: rule.minimumBodyChangePct,
      directions: selected.map(classifyCandleDirection),
      bodyChangePct: selected.map((candle) => String(calculateCandleBodyChangePct(candle))),
    },
    children: [],
  };
}

/** Evaluates one validated condition tree without persistence, time, or position dependencies. */
export function evaluateCondition(
  condition: StrategyCondition,
  context: ConditionEvaluationContext,
): ConditionEvaluation {
  if (historicalCandles(context).some((candle) => !candle.isClosed))
    throw new Error("condition evaluation requires closed candles");
  return evaluateNode(condition, context);
}

/** Internal fast path for a history that the backtest runner already validated. */
export function evaluateValidatedCondition(
  condition: StrategyCondition,
  context: ConditionEvaluationContext,
): ConditionEvaluation {
  return evaluateNode(condition, context);
}
