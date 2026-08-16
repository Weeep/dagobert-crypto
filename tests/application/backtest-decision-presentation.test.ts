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

test("backtest decision presentation explains fee-aware position return", () => {
  const summaries = conditionObservationSummaries({
    type: "POSITION_RETURN_PCT", matched: true, reasonCode: "POSITION_RETURN_PCT_MATCHED",
    explanation: "matched", children: [], observedValues: {
      positionId: "lot-1", observed: "2.15", operator: "GTE", expected: 2,
      entryFees: "0.1", estimatedExitFee: "0.11",
    },
  });
  assert.deepEqual(summaries, [
    "Lot lot-1 net return: 2.15% · condition ≥ 2% · entry fees 0.1 · estimated exit fee 0.11 · matched",
  ]);
});

test("backtest decision presentation explains signed EMA deviation", () => {
  assert.deepEqual(conditionObservationSummaries({
    type: "EMA_DEVIATION_PCT", matched: true, reasonCode: "EMA_DEVIATION_PCT_MATCHED",
    explanation: "matched", children: [], observedValues: { close: "98", ema: 100, period: 100,
      observed: "-2", operator: "LTE", expected: -2 },
  }), ["Close 98 · EMA(100): 100 · signed deviation -2% · condition ≤ -2% · matched"]);
});
