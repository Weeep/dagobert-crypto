import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test, { describe } from "node:test";
import type { Candle } from "@/src/modules/market";
import {
  calculateEma,
  calculateRsi,
  evaluateStrategy,
  validateStrategyDefinition,
  type ConditionEvaluation,
  type StrategyAction,
  type StrategyDefinitionV1,
  type StrategyPositionContext,
} from "@/src/modules/strategy";

const fixturePath = (...parts: string[]) => join(process.cwd(), "tests", "fixtures", "strategy", ...parts);
const readJson = <T>(fileName: string): T => JSON.parse(readFileSync(fixturePath(fileName), "utf8")) as T;

type SerializedCandle = Omit<Candle, "openTime" | "closeTime" | "receivedAt"> & {
  openTime: string; closeTime: string; receivedAt: string;
};
type IndicatorPoint = { candleId: string; value: number | null };
type IndicatorFixture = {
  comparison: { type: "absoluteTolerance"; tolerance: number };
  series: { rsi14: IndicatorPoint[]; ema20: IndicatorPoint[]; ema100: IndicatorPoint[] };
};
type DecisionExpectation = {
  action: StrategyAction;
  reasonCode: string;
  policyReasons: string[];
  entryMatched: boolean;
  exitMatched: boolean;
  requiredLeafReasons: string[];
};
type DecisionFixture = { scenarios: Array<{
  name: string;
  evaluatedCandleId: string;
  position: StrategyPositionContext;
  expected: DecisionExpectation;
}> };

const candleDocument = readJson<{ candles: SerializedCandle[] }>("reference-candles.json");
const candles: Candle[] = candleDocument.candles.map((candle) => ({
  ...candle,
  openTime: new Date(candle.openTime),
  closeTime: new Date(candle.closeTime),
  receivedAt: new Date(candle.receivedAt),
}));
const strategy = readJson<StrategyDefinitionV1>("strategy-v1.json");
const indicators = readJson<IndicatorFixture>("expected-indicators.json");
const decisions = readJson<DecisionFixture>("expected-decisions.json");

function assertSeries(
  expected: readonly IndicatorPoint[],
  calculate: (history: readonly Candle[]) => number | null,
): void {
  assert.equal(expected.length, candles.length);
  expected.forEach((point, index) => {
    assert.equal(point.candleId, candles[index].id);
    const actual = calculate(candles.slice(0, index + 1));
    if (point.value === null) assert.equal(actual, null, `${point.candleId} must still be warming up`);
    else {
      assert.notEqual(actual, null, `${point.candleId} must have an indicator value`);
      assert.ok(Math.abs(actual! - point.value) <= indicators.comparison.tolerance,
        `${point.candleId}: expected ${point.value}, received ${actual}`);
    }
  });
}

function leafReasonCodes(evaluation: ConditionEvaluation): string[] {
  return evaluation.children.length === 0
    ? [evaluation.reasonCode]
    : evaluation.children.flatMap(leafReasonCodes);
}

describe("Phase 3 golden acceptance fixture", () => {
  test("contains immutable, ordered, closed, single-market reference candles and a valid v1 strategy", () => {
    assert.equal(candles.length, 140);
    assert.equal(validateStrategyDefinition(strategy).ok, true);
    const ids = new Set<string>();
    candles.forEach((candle, index) => {
      assert.equal(candle.isClosed, true);
      assert.equal(candle.pairSymbol, "REFERENCEUSDC");
      assert.equal(candle.interval, "1h");
      assert.equal(ids.has(candle.id), false);
      ids.add(candle.id);
      if (index > 0) assert.ok(candle.openTime > candles[index - 1].openTime);
    });
  });

  test("matches independent Wilder RSI and standard EMA values for every historical prefix", () => {
    assert.equal(indicators.comparison.type, "absoluteTolerance");
    assertSeries(indicators.series.rsi14, (history) => calculateRsi(history, 14));
    assertSeries(indicators.series.ema20, (history) => calculateEma(history, 20));
    assertSeries(indicators.series.ema100, (history) => calculateEma(history, 100));
  });

  for (const scenario of decisions.scenarios) {
    test(`reproduces decision: ${scenario.name}`, () => {
      const index = candles.findIndex((candle) => candle.id === scenario.evaluatedCandleId);
      assert.notEqual(index, -1);
      const input = { definition: strategy, candles: candles.slice(0, index + 1),
        evaluatedCandle: candles[index], position: scenario.position };
      const actual = evaluateStrategy(input);
      assert.equal(actual.action, scenario.expected.action);
      assert.equal(actual.reasonCode, scenario.expected.reasonCode);
      assert.deepEqual(actual.policyReasons, scenario.expected.policyReasons);
      assert.equal(actual.entry.matched, scenario.expected.entryMatched);
      assert.equal(actual.exit.matched, scenario.expected.exitMatched);
      const reasons = [...leafReasonCodes(actual.entry), ...leafReasonCodes(actual.exit)];
      scenario.expected.requiredLeafReasons.forEach((reason) => assert.ok(reasons.includes(reason)));
      assert.deepEqual(evaluateStrategy(input), actual, "identical snapshots must reproduce the complete result");
    });
  }

  test("rejects a future candle instead of allowing look-ahead", () => {
    const evaluatedIndex = 100;
    assert.throws(() => evaluateStrategy({
      definition: strategy,
      candles: candles.slice(0, evaluatedIndex + 2),
      evaluatedCandle: candles[evaluatedIndex],
      position: { hasOpenPositions: false, openPositionCount: 0, exitFeeRate: "0.001", positions: [] },
    }), /future candle/);
  });

  test("keeps unsupported legacy EMA JSON outside the v1 activation contract", () => {
    const legacy = { ...strategy, entry: { indicator: "EMA_DISTANCE", period: 100,
      operator: "ABS_LTE", value: 0.02 } };
    assert.equal(validateStrategyDefinition(legacy).ok, false);
  });
});
