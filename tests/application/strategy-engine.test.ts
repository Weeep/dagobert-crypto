import assert from "node:assert/strict";
import test, { describe } from "node:test";
import type { Candle } from "@/src/modules/market";
import {
  evaluateCondition,
  evaluateStrategy,
  createHistoricalIndicatorCache,
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
  exitFeeRate: "0.001",
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

  test("compares signed EMA deviation percentages across both sides of the EMA", () => {
    const below = candles([100, 96]); // EMA(2) = 98, close deviation is about -2.0408%.
    const atBoundary = candles([100, 100]);
    assert.equal(evaluateCondition({ indicator: "EMA_DEVIATION_PCT", period: 2,
      operator: "LTE", value: -2 }, { candles: below }).matched, true);
    assert.equal(evaluateCondition({ indicator: "EMA_DEVIATION_PCT", period: 2,
      operator: "GTE", value: -2 }, { candles: below }).matched, false);
    assert.equal(evaluateCondition({ indicator: "EMA_DEVIATION_PCT", period: 2,
      operator: "LT", value: 0 }, { candles: atBoundary }).matched, false);
    const result = evaluateCondition({ indicator: "EMA_DEVIATION_PCT", period: 2,
      operator: "LTE", value: -2 }, { candles: below });
    assert.equal(result.type, "EMA_DEVIATION_PCT");
    assert.ok(Math.abs(Number(result.observedValues.observed) + 2.0408163265306123) < 1e-12);
  });

  test("classifies market regime from EMA7, EMA25, and EMA100 ordering", () => {
    const rising = candles(Array.from({ length: 100 }, (_, index) => index + 1));
    const bullish = evaluateCondition({ indicator: "MARKET_REGIME", value: "BULLISH" }, { candles: rising });
    assert.equal(bullish.matched, true);
    assert.equal(bullish.observedValues.observed, "BULLISH");
    const falling = candles(Array.from({ length: 100 }, (_, index) => 100 - index));
    assert.equal(evaluateCondition({ indicator: "MARKET_REGIME", value: "BEARISH" },
      { candles: falling }).matched, true);
    const flat = candles(Array(100).fill(10));
    assert.equal(evaluateCondition({ indicator: "MARKET_REGIME", value: "SIDEWAYS" },
      { candles: flat }).matched, true);
    assert.equal(evaluateCondition({ indicator: "MARKET_REGIME", value: "BULLISH" },
      { candles: candles([1, 2]) }).reasonCode, "INSUFFICIENT_HISTORY");
  });

  test("compares signed EMA slope over the configured candle lookback", () => {
    const history = candles([100, 100, 100, 103]);
    const rising = evaluateCondition({ indicator: "EMA_SLOPE", period: 2, lookbackCandles: 2,
      operator: "GTE", value: 1 }, { candles: history });
    assert.equal(rising.matched, true);
    assert.equal(rising.observedValues.previousEma, 100);
    assert.equal(rising.observedValues.currentEma, 102);
    assert.equal(rising.observedValues.observed, "2");
    assert.equal(evaluateCondition({ indicator: "EMA_SLOPE", period: 2, lookbackCandles: 2,
      operator: "GT", value: 2 }, { candles: history }).matched, false);
    assert.equal(evaluateCondition({ indicator: "EMA_SLOPE", period: 2, lookbackCandles: 2,
      operator: "GTE", value: 1 }, { candles: history.slice(1) }).reasonCode, "INSUFFICIENT_HISTORY");
  });

  test("uses the same bounded EMA seeds in cached backtests and live windows", () => {
    const prefix = candles([
      ...Array(100).fill(100),
      ...Array.from({ length: 100 }, (_, index) => 200 + index),
    ]);
    const cache = createHistoricalIndicatorCache(prefix);

    for (const condition of [
      { indicator: "MARKET_REGIME" as const, value: "BULLISH" as const },
      { indicator: "EMA_SLOPE" as const, period: 2, lookbackCandles: 2,
        operator: "GTE" as const, value: 0 },
    ]) {
      const required = condition.indicator === "MARKET_REGIME"
        ? 100 : condition.period + condition.lookbackCandles;
      const backtest = evaluateCondition(condition, {
        candles: prefix, endIndex: prefix.length - 1, indicatorCache: cache,
      });
      const live = evaluateCondition(condition, { candles: prefix.slice(-required) });
      assert.deepEqual(backtest, live);
    }
  });

  test("confirms an EMA crossing against each candle's contemporaneous EMA only once", () => {
    const condition = { indicator: "EMA_CROSS_CONFIRMATION" as const, period: 2,
      direction: "ABOVE" as const, confirmationCandles: 3 };
    const crossing = candles([10, 9, 12, 13, 14]);
    const result = evaluateCondition(condition, { candles: crossing });
    assert.equal(result.matched, true);
    assert.deepEqual(result.observedValues.confirmedSides, ["true", "true", "true"]);
    assert.equal(result.observedValues.previousOnOppositeSide, true);
    assert.equal(evaluateCondition(condition, { candles: [...crossing, ...candles([15]).map((candle) => ({
      ...candle, id: "candle-5", openTime: new Date(start + 5 * 3_600_000),
      closeTime: new Date(start + 6 * 3_600_000 - 1), close: "15",
    }))] }).matched, false);

    const below = evaluateCondition({ ...condition, direction: "BELOW" },
      { candles: candles([10, 11, 8, 7, 6]) });
    assert.equal(below.matched, true);
  });

  test("seeds confirmed crossing EMA from the same bounded window in live runs and backtests", () => {
    const condition = { indicator: "EMA_CROSS_CONFIRMATION" as const, period: 2,
      direction: "ABOVE" as const, confirmationCandles: 1 };
    const fullPrefix = candles([100, 100, 1, 1, 2]);
    const liveWindow = fullPrefix.slice(-3);

    const backtestResult = evaluateCondition(condition, { candles: fullPrefix });
    const liveResult = evaluateCondition(condition, { candles: liveWindow });

    assert.equal(liveResult.matched, true);
    assert.equal(backtestResult.matched, liveResult.matched);
    assert.deepEqual(backtestResult.observedValues.emas, liveResult.observedValues.emas);
  });

  test("reports the full EMA crossing warm-up requirement", () => {
    const result = evaluateCondition({ indicator: "EMA_CROSS_CONFIRMATION", period: 100,
      direction: "ABOVE", confirmationCandles: 3 }, { candles: candles([10, 11]) });
    assert.equal(result.reasonCode, "INSUFFICIENT_HISTORY");
    assert.equal(result.observedValues.requiredCandles, 103);
  });

  test("rejects open candles even for candle-only conditions", () => {
    const history = candles([10]);
    assert.throws(() => evaluateCondition(
      { candleSequence: { count: 1, direction: "RED", minimumBodyChangePct: 0 } },
      { candles: [{ ...history[0], isClosed: false }] },
    ), /requires closed candles/);
  });

  test("bounds uncached endIndex indicator evaluation to its causal prefix", () => {
    const history = candles([10, 11, 9, 100]);
    const rsi = { indicator: "RSI" as const, period: 2, operator: "LT" as const, value: 100 };
    const ema = { indicator: "EMA_DISTANCE" as const, period: 2, position: "ABOVE" as const };
    assert.deepEqual(evaluateCondition(rsi, { candles: history, endIndex: 2 }),
      evaluateCondition(rsi, { candles: history.slice(0, 3) }));
    assert.deepEqual(evaluateCondition(ema, { candles: history, endIndex: 2 }),
      evaluateCondition(ema, { candles: history.slice(0, 3) }));
    assert.doesNotThrow(() => evaluateCondition(ema, {
      candles: [...history.slice(0, 3), { ...history[3], isClosed: false }], endIndex: 2,
    }));
  });
});

describe("strategy engine", () => {
  test("selects lots independently with fee-aware take-profit or stop-loss return rules", () => {
    const history = candles([100]);
    const definition: StrategyDefinitionV1 = {
      schemaVersion: 1, name: "Per-lot TP/SL",
      entry: { all: [{ indicator: "RSI", period: 14, operator: "LT", value: 0 }] },
      exit: { any: [
        { indicator: "POSITION_RETURN_PCT", operator: "GTE", value: 2 },
        { indicator: "POSITION_RETURN_PCT", operator: "LTE", value: -4 },
      ] },
    };
    const result = evaluateStrategy({ definition, candles: history, evaluatedCandle: history[0],
      position: { hasOpenPositions: true, openPositionCount: 3, exitFeeRate: "0.001", positions: [
        { id: "winner", entryPrice: "90", quantity: "1", entryCost: "90", entryFees: "0.09", openedAt: null },
        { id: "middle", entryPrice: "99", quantity: "1", entryCost: "99", entryFees: "0.099", openedAt: null },
        { id: "loser", entryPrice: "110", quantity: "1", entryCost: "110", entryFees: "0.11", openedAt: null },
      ] } });
    assert.equal(result.action, "SELL");
    assert.deepEqual(result.selectedPositionIds, ["winner", "loser"]);
    assert.deepEqual(result.positionExits.map(({ evaluation }) => evaluation.matched), [true, false, true]);
    const winnerTakeProfit = result.positionExits[0].evaluation.children[0];
    assert.equal(winnerTakeProfit.type, "POSITION_RETURN_PCT");
    assert.equal(winnerTakeProfit.observedValues.estimatedExitFee, "0.1");
    assert.ok(Number(winnerTakeProfit.observedValues.observed) > 10);
  });

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
      position: { hasOpenPositions: true, openPositionCount: 0, exitFeeRate: "0.001", positions: [] } }), /inconsistent/);
  });
});
