import assert from "node:assert/strict";
import test, { describe } from "node:test";
import type { Candle } from "@/src/modules/market";
import {
  evaluateCondition,
  evaluateStrategy,
  type StrategyDefinitionV1,
  type StrategyPositionContext,
} from "@/src/modules/strategy";

const start = Date.parse("2026-01-01T00:00:00.000Z");
function candles(closes: readonly number[]): Candle[] {
  return closes.map((close, index) => ({
    id: `candle-${index}`, pairSymbol: "BTCUSDC", interval: "1h",
    openTime: new Date(start + index * 3_600_000),
    closeTime: new Date(start + (index + 1) * 3_600_000 - 1),
    open: String(close + 1), high: String(close + 2), low: String(close - 1), close: String(close),
    volume: "10", quoteVolume: "1000", trades: 10, isClosed: true,
    source: "TEST", receivedAt: new Date(start + (index + 1) * 3_600_000),
  }));
}

const sequenceDefinition = (entryDirection: "RED" | "GREEN" = "RED", exitDirection: "RED" | "GREEN" = "RED"): StrategyDefinitionV1 => ({
  schemaVersion: 1, name: "Sequence policy",
  entry: { all: [{ candleSequence: { count: 1, direction: entryDirection, minimumBodyChangePct: 0 } }] },
  exit: { all: [{ candleSequence: { count: 1, direction: exitDirection, minimumBodyChangePct: 0 } }] },
});
const position = (count: number): StrategyPositionContext => ({
  hasOpenPositions: count > 0,
  openPositionCount: count,
  positions: Array.from({ length: count }, (_, index) => ({ id: `position-${index}`,
    entryPrice: "100", quantity: "1", entryCost: "100", entryFees: "0", openedAt: null })),
});

describe("pure condition-tree evaluator", () => {
  test("evaluates nested all/any groups and retains every explainable child result", () => {
    const history = candles([44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42,
      45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46, 46.03, 46.41, 46.22, 45.64]);
    const result = evaluateCondition({ any: [
      { all: [
        { indicator: "RSI", period: 14, operator: "LT", value: 60 },
        { indicator: "EMA_DISTANCE", period: 5, position: "BELOW", maximumDistancePct: 10 },
      ] },
      { candleSequence: { count: 3, direction: "GREEN", minimumBodyChangePct: 20 } },
    ] }, { candles: history });
    assert.equal(result.matched, true);
    assert.equal(result.reasonCode, "ANY_MATCHED");
    assert.equal(result.children.length, 2);
    assert.equal(result.children[0].reasonCode, "ALL_MATCHED");
    assert.equal(result.children[0].children[0].type, "RSI");
    assert.equal(typeof result.children[0].children[0].observedValues.observed, "number");
  });

  test("returns false with INSUFFICIENT_HISTORY rather than coercing a missing indicator to zero", () => {
    const result = evaluateCondition({ indicator: "RSI", period: 14, operator: "LT", value: 20 },
      { candles: candles([10, 9]) });
    assert.equal(result.matched, false);
    assert.equal(result.reasonCode, "INSUFFICIENT_HISTORY");
    assert.equal(result.observedValues.observed, null);
  });

  test("evaluates strict EMA side and an optional percentage distance", () => {
    const above = candles([10, 10, 12]);
    assert.equal(evaluateCondition({ indicator: "EMA_DISTANCE", period: 2, position: "ABOVE" },
      { candles: above }).matched, true);
    assert.equal(evaluateCondition({ indicator: "EMA_DISTANCE", period: 2, position: "BELOW" },
      { candles: above }).matched, false);
    assert.equal(evaluateCondition({ indicator: "EMA_DISTANCE", period: 2, position: "ABOVE", maximumDistancePct: 5 },
      { candles: above }).matched, false);
    assert.equal(evaluateCondition({ indicator: "EMA_DISTANCE", period: 2, position: "ABOVE", maximumDistancePct: 6 },
      { candles: above }).matched, true);
    const equal = candles([10, 10]);
    assert.equal(evaluateCondition({ indicator: "EMA_DISTANCE", period: 2, position: "ABOVE" },
      { candles: equal }).matched, false);
    assert.equal(evaluateCondition({ indicator: "EMA_DISTANCE", period: 2, position: "BELOW" },
      { candles: equal }).matched, false);
  });

  test("rejects open candles even for candle-only conditions", () => {
    const history = candles([10]);
    assert.throws(() => evaluateCondition(
      { candleSequence: { count: 1, direction: "RED", minimumBodyChangePct: 0 } },
      { candles: [{ ...history[0], isClosed: false }] },
    ), /requires closed candles/);
  });
});

describe("strategy engine", () => {
  test("gives an actionable exit priority when entry and exit both match", () => {
    const history = candles([100, 99]);
    const result = evaluateStrategy({ definition: sequenceDefinition(), candles: history,
      evaluatedCandle: history.at(-1)!, position: position(2) });
    assert.equal(result.exit.matched, true);
    assert.equal(result.entry.matched, true);
    assert.equal(result.action, "SELL");
    assert.equal(result.reasonCode, "EXIT_MATCHED");
    assert.deepEqual(result.selectedPositionIds, ["position-0", "position-1"]);
    assert.deepEqual(result.positionExits.map(({ positionId, evaluation }) =>
      [positionId, evaluation.matched]), [["position-0", true], ["position-1", true]]);
  });

  test("records a non-actionable exit and allows entry when no position is open", () => {
    const history = candles([100, 99]);
    const result = evaluateStrategy({ definition: sequenceDefinition(), candles: history,
      evaluatedCandle: history.at(-1)!, position: position(0) });
    assert.equal(result.action, "BUY");
    assert.equal(result.reasonCode, "ENTRY_MATCHED_AFTER_NON_ACTIONABLE_EXIT");
    assert.deepEqual(result.policyReasons, ["EXIT_MATCHED_NO_OPEN_POSITION", "ENTRY_MATCHED_AFTER_NON_ACTIONABLE_EXIT"]);
  });

  test("returns HOLD when no condition is actionable", () => {
    const history = candles([100, 99]);
    const result = evaluateStrategy({ definition: sequenceDefinition("GREEN", "GREEN"), candles: history,
      evaluatedCandle: history.at(-1)!, position: position(0) });
    assert.equal(result.action, "HOLD");
    assert.equal(result.reasonCode, "NO_ACTIONABLE_CONDITION");
  });

  test("returns one non-actionable-exit reason when exit matches without a position or entry", () => {
    const history = candles([100, 99]);
    const result = evaluateStrategy({ definition: sequenceDefinition("GREEN", "RED"), candles: history,
      evaluatedCandle: history.at(-1)!, position: position(0) });
    assert.equal(result.action, "HOLD");
    assert.equal(result.reasonCode, "EXIT_MATCHED_NO_OPEN_POSITION");
    assert.deepEqual(result.policyReasons, ["EXIT_MATCHED_NO_OPEN_POSITION"]);
  });

  test("is reproducible for identical strategy, history, candle, and position snapshots", () => {
    const history = candles([100, 99]);
    const input = { definition: sequenceDefinition(), candles: history,
      evaluatedCandle: history.at(-1)!, position: position(1) };
    assert.deepEqual(evaluateStrategy(input), evaluateStrategy(input));
  });

  test("rejects future, open, mixed-market, unordered, and inconsistent position inputs", () => {
    const history = candles([100, 99, 98]);
    const base = { definition: sequenceDefinition(), candles: history.slice(0, 2),
      evaluatedCandle: history[1], position: position(0) };
    assert.throws(() => evaluateStrategy({ ...base, candles: history }), /future candle/);
    assert.throws(() => evaluateStrategy({ ...base, candles: [{ ...history[0], isClosed: false }, history[1]] }), /open candle/);
    assert.throws(() => evaluateStrategy({ ...base, candles: [history[0], { ...history[1], pairSymbol: "ETHUSDC" }] }), /symbol and interval/);
    assert.throws(() => evaluateStrategy({ ...base, candles: [history[1], history[0]] }), /strictly ordered/);
    assert.throws(() => evaluateStrategy({ ...base, evaluatedCandle: { ...history[1], close: "97" } }), /final unique candle/);
    assert.throws(() => evaluateStrategy({ ...base,
      position: { hasOpenPositions: true, openPositionCount: 0, positions: [] } }), /inconsistent/);
  });
});
