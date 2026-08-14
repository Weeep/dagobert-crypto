import Big from "big.js";
import type { Candle } from "@/src/modules/market";
import { calculateEma, calculateRsi } from "./TechnicalIndicators";
import {
  calculateCandleBodyChangePct,
  classifyCandleDirection,
  matchesCandleSequence,
} from "./CandleFacts";
import type { ComparisonOperator, StrategyCondition } from "./StrategyDefinition";

export type ConditionObservedValues = Record<string, string | number | boolean | null | string[]>;
export type ConditionEvaluation = {
  type: "ALL" | "ANY" | "RSI" | "EMA_DISTANCE" | "CANDLE_SEQUENCE";
  matched: boolean;
  reasonCode: string;
  explanation: string;
  observedValues: ConditionObservedValues;
  children: ConditionEvaluation[];
};

export type ConditionEvaluationContext = { candles: readonly Candle[] };

function compare(observed: number, expected: number, operator: ComparisonOperator): boolean {
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
    const observed = calculateRsi(context.candles, condition.period);
    if (observed === null) return insufficient("RSI", required, context.candles.length);
    const matched = compare(observed, condition.value, condition.operator);
    return {
      type: "RSI", matched, reasonCode: `RSI_${matched ? "MATCHED" : "NOT_MATCHED"}`,
      explanation: `RSI(${condition.period}) ${observed} ${matched ? "matched" : "did not match"} ${condition.operator} ${condition.value}`,
      observedValues: { indicator: "RSI", period: condition.period, operator: condition.operator,
        expected: condition.value, observed }, children: [],
    };
  }

  if ("indicator" in condition) {
    const observedEma = calculateEma(context.candles, condition.period);
    if (observedEma === null) return insufficient("EMA_DISTANCE", condition.period, context.candles.length);
    const close = new Big(context.candles.at(-1)!.close);
    const ema = new Big(observedEma);
    const distance = ema.eq(0) ? null : Number(close.minus(ema).abs().div(ema));
    const matched = distance !== null && new Big(distance).lte(condition.value);
    return {
      type: "EMA_DISTANCE", matched,
      reasonCode: distance === null ? "EMA_DISTANCE_UNDEFINED" : `EMA_DISTANCE_${matched ? "MATCHED" : "NOT_MATCHED"}`,
      explanation: distance === null
        ? `EMA(${condition.period}) distance is undefined because EMA is zero`
        : `EMA(${condition.period}) absolute distance ${distance} ${matched ? "matched" : "did not match"} ABS_LTE ${condition.value}`,
      observedValues: { indicator: "EMA_DISTANCE", period: condition.period, operator: condition.operator,
        expected: condition.value, close: close.toString(), ema: observedEma, observed: distance }, children: [],
    };
  }

  const rule = condition.candleSequence;
  if (context.candles.length < rule.count)
    return insufficient("CANDLE_SEQUENCE", rule.count, context.candles.length);
  const selected = context.candles.slice(-rule.count);
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
  if (context.candles.some((candle) => !candle.isClosed))
    throw new Error("condition evaluation requires closed candles");
  return evaluateNode(condition, context);
}
