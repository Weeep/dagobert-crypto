import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test, { describe } from "node:test";
import type { BacktestExecutionConfig, HistoricalBacktestResult } from "@/src/modules/bot";
import { calculateBacktestMetrics, runHistoricalBacktest } from "@/src/modules/bot";
import type { Candle } from "@/src/modules/market";
import { validateStrategyDefinition, type StrategyDefinitionV1 } from "@/src/modules/strategy";

const fixturePath = (...parts: string[]) => join(process.cwd(), "tests", "fixtures", "backtest", ...parts);
const readJson = <T>(fileName: string): T => JSON.parse(readFileSync(fixturePath(fileName), "utf8")) as T;

type SerializedCandle = Omit<Candle, "openTime" | "closeTime" | "receivedAt"> & {
  openTime: string; closeTime: string; receivedAt: string;
};
type ExecutionFixture = {
  backtestFrom: string;
  backtestTo: string;
  configuration: BacktestExecutionConfig;
};
type GoldenResult = { result: HistoricalBacktestResult; metrics: ReturnType<typeof calculateBacktestMetrics> };

const candleDocument = readJson<{ candles: SerializedCandle[] }>("phase4-candles.json");
const candles: Candle[] = candleDocument.candles.map((candle) => ({
  ...candle,
  openTime: new Date(candle.openTime),
  closeTime: new Date(candle.closeTime),
  receivedAt: new Date(candle.receivedAt),
}));
const strategy = readJson<StrategyDefinitionV1>("phase4-strategy.json");
const execution = readJson<ExecutionFixture>("phase4-execution.json");
const expected = readJson<GoldenResult>("phase4-expected-result.json");
const canonicalize = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const execute = (): GoldenResult => {
  const from = new Date(execution.backtestFrom);
  const to = new Date(execution.backtestTo);
  const result = runHistoricalBacktest({ definition: strategy, candles,
    backtestFrom: from, backtestTo: to, execution: execution.configuration });
  const evaluatedCandles = candles.filter((candle) => candle.openTime >= from && candle.openTime <= to);
  return canonicalize({ result, metrics: calculateBacktestMetrics(result, evaluatedCandles, execution.configuration) });
};

describe("Phase 4 golden backtest acceptance fixture", () => {
  test("contains immutable warm-up and execution inputs for a valid confirmed EMA crossing strategy", () => {
    assert.equal(validateStrategyDefinition(strategy).ok, true);
    assert.equal(candles.length, 8);
    assert.equal(candles.filter((candle) => candle.openTime < new Date(execution.backtestFrom)).length, 3);
    candles.forEach((candle, index) => {
      assert.equal(candle.isClosed, true);
      assert.equal(candle.pairSymbol, "GOLDENUSDC");
      assert.equal(candle.interval, "1h");
      if (index > 0) assert.ok(candle.openTime > candles[index - 1].openTime);
    });
  });

  test("matches the complete immutable event and result set", () => {
    const actual = execute();
    assert.deepEqual(actual, expected);
    assert.deepEqual(execute(), actual, "identical snapshots must reproduce the complete backtest");
  });

  test("closes Step 4D through the production historical runner without repeated crossing entries", () => {
    const { result } = execute();
    assert.deepEqual(result.evaluatedCandleIds,
      ["golden-candle-003", "golden-candle-004", "golden-candle-005", "golden-candle-006", "golden-candle-007"]);
    assert.equal(result.decisions[0].evaluation.entry.reasonCode, "EMA_CROSS_CONFIRMATION_MATCHED");
    assert.equal(result.decisions[0].executionOutcome, "ENTRY_RESERVED");
    assert.equal(result.fills[0].side, "BUY");
    assert.equal(result.fills[0].filledAt, candles[4].openTime.toISOString());
    assert.equal(result.decisions.filter(({ executionOutcome }) => executionOutcome === "ENTRY_RESERVED").length, 1);
    assert.deepEqual(result.decisions[2].evaluation.selectedPositionIds, ["position:golden-candle-003"]);
    assert.equal(result.fills[1].side, "SELL");
    assert.equal(result.fills[1].filledAt, candles[6].openTime.toISOString());
    assert.equal(result.portfolio.closedPositions[0].quantity, result.fills[1].quantity);
  });
});
