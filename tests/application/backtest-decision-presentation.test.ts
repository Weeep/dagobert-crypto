import assert from "node:assert/strict";
import test from "node:test";
import { conditionObservationSummaries } from "@/app/components/pageBot/backtestDecisionPresentation";
import type { ConditionEvaluation } from "@/src/modules/strategy";

test("backtest decision presentation exposes RSI observation and threshold", () => {
  const evaluation: ConditionEvaluation = { type: "ALL", matched: false, reasonCode: "ALL_NOT_MATCHED",
    explanation: "ALL group did not match", observedValues: { matchedChildren: 0, totalChildren: 1 }, children: [{
      type: "RSI", matched: false, reasonCode: "RSI_NOT_MATCHED", explanation: "RSI did not match",
      observedValues: { indicator: "RSI", period: 14, operator: "LT", expected: 18, observed: 56.123456 }, children: [],
    }] };
  assert.deepEqual(conditionObservationSummaries(evaluation),
    ["RSI(14): 56.1235 · condition < 18 · not matched"]);
});

test("backtest decision presentation explains indicator warm-up", () => {
  const evaluation: ConditionEvaluation = { type: "RSI", matched: false, reasonCode: "INSUFFICIENT_HISTORY",
    explanation: "warm-up", observedValues: { requiredCandles: 15, availableCandles: 4, observed: null }, children: [] };
  assert.deepEqual(conditionObservationSummaries(evaluation), ["RSI: insufficient history (4/15 candles)"]);
});
