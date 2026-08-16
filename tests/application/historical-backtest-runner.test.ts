import assert from "node:assert/strict";
import test, { describe } from "node:test";
import type { Candle } from "@/src/modules/market";
import {
  HistoricalBacktestInputError,
  runHistoricalBacktest,
  type BacktestExecutionConfig,
} from "@/src/modules/bot";
import type { StrategyDefinitionV1 } from "@/src/modules/strategy";

const execution: BacktestExecutionConfig = {
  assignedBudget: "55",
  amountPerPosition: "10",
  feeRate: "0.001",
  slippageRate: "0.005",
};

const candle = (index: number, open: string, close: string, closed = true): Candle => {
  const openTime = new Date(Date.UTC(2026, 0, 1, index));
  return {
    id: `candle-${index}`,
    pairSymbol: "BTCUSDC",
    interval: "1h",
    openTime,
    closeTime: new Date(openTime.getTime() + 3_599_999),
    open,
    high: String(Math.max(Number(open), Number(close)) + 1),
    low: String(Math.min(Number(open), Number(close)) - 1),
    close,
    volume: "1",
    quoteVolume: "100",
    trades: 1,
    source: "TEST",
    isClosed: closed,
    receivedAt: new Date(openTime.getTime() + 3_600_000),
  };
};

const sequenceStrategy: StrategyDefinitionV1 = {
  schemaVersion: 1,
  name: "Green entry, red exit",
  entry: { candleSequence: { count: 1, direction: "GREEN", minimumBodyChangePct: 0 } },
  exit: { candleSequence: { count: 1, direction: "RED", minimumBodyChangePct: 0 } },
};

const timeline = [
  candle(0, "100", "101"),
  candle(1, "102", "103"),
  candle(2, "104", "100"),
  candle(3, "110", "112"),
];

const run = (candles: readonly Candle[] = timeline) => runHistoricalBacktest({
  definition: sequenceStrategy,
  candles,
  backtestFrom: candles[0].openTime,
  backtestTo: candles.at(-1)!.openTime,
  execution,
});

describe("deterministic historical backtest runner", () => {
  test("fills decisions only at the next candle open and closes every open lot", () => {
    const result = run();
    assert.deepEqual(result.decisions.map(({ evaluation }) => evaluation.action), ["BUY", "BUY", "SELL", "BUY"]);
    assert.deepEqual(result.decisions.map(({ executionOutcome }) => executionOutcome),
      ["ENTRY_RESERVED", "ENTRY_RESERVED", "EXIT_SCHEDULED", "ENTRY_RESERVED"]);
    assert.deepEqual(result.fills.map(({ side }) => side), ["BUY", "BUY", "SELL", "SELL"]);
    assert.equal(result.fills[0].filledAt, timeline[1].openTime.toISOString());
    assert.equal(result.fills[0].price, "102.51");
    assert.equal(result.fills[1].filledAt, timeline[2].openTime.toISOString());
    assert.equal(result.fills[1].price, "104.52");
    assert.ok(result.fills.slice(2).every((fill) => fill.filledAt === timeline[3].openTime.toISOString()));
    assert.ok(result.fills.slice(2).every((fill) => fill.price === "109.45"));
    assert.equal(result.portfolio.openPositions.length, 0);
    assert.equal(result.portfolio.closedPositions.length, 2);
    assert.equal(result.portfolio.reservations.length, 0);
  });

  test("records and releases a final intent instead of inventing a fill", () => {
    const future = candle(4, "500", "501");
    const result = runHistoricalBacktest({ definition: sequenceStrategy, candles: [...timeline, future],
      backtestFrom: timeline[0].openTime, backtestTo: timeline[3].openTime, execution });
    assert.equal(result.events.at(-1)?.eventType, "UNFILLED_AT_END_OF_RANGE");
    assert.deepEqual(result.events.at(-1)?.payload,
      { decisionCandleId: timeline[3].id, side: "BUY" });
    assert.equal(result.fills.filter((fill) => fill.side === "BUY").length, 2);
    assert.ok(result.fills.every((fill) => fill.filledAt !== future.openTime.toISOString()));
    assert.equal(result.portfolio.reservations.length, 0);
    assert.equal(result.snapshots.at(-2)?.portfolio.reservedCash, "10");
    assert.equal(result.snapshots.at(-1)?.portfolio.reservedCash, "0");
  });

  test("does not force-close an exit scheduled by the final candle", () => {
    const result = runHistoricalBacktest({ definition: sequenceStrategy, candles: timeline.slice(0, 3),
      backtestFrom: timeline[0].openTime, backtestTo: timeline[2].openTime, execution });
    assert.equal(result.decisions.at(-1)?.executionOutcome, "EXIT_SCHEDULED");
    assert.equal(result.events.at(-1)?.eventType, "UNFILLED_AT_END_OF_RANGE");
    assert.equal(result.portfolio.openPositions.length, 2);
    assert.equal(result.portfolio.closedPositions.length, 0);
    assert.equal(result.fills.filter((fill) => fill.side === "SELL").length, 0);
  });

  test("fee-aware stop-loss closes only the matching lot at the next open", () => {
    const candles = [candle(0, "100", "101"), candle(1, "100", "101"),
      candle(2, "120", "100"), candle(3, "90", "90")];
    const strategy: StrategyDefinitionV1 = {
      schemaVersion: 1, name: "Per-lot stop",
      entry: { candleSequence: { count: 1, direction: "GREEN", minimumBodyChangePct: 0 } },
      exit: { any: [
        { indicator: "POSITION_RETURN_PCT", operator: "GTE", value: 2 },
        { indicator: "POSITION_RETURN_PCT", operator: "LTE", value: -4 },
      ] },
    };
    const result = runHistoricalBacktest({ definition: strategy, candles,
      backtestFrom: candles[0].openTime, backtestTo: candles.at(-1)!.openTime, execution });
    const exitDecision = result.decisions[2];
    assert.deepEqual(exitDecision.evaluation.selectedPositionIds, ["position:candle-1"]);
    assert.equal(exitDecision.executionOutcome, "EXIT_SCHEDULED");
    assert.deepEqual(result.fills.filter((fill) => fill.side === "SELL").map((fill) => fill.positionId),
      ["position:candle-1"]);
    assert.deepEqual(result.portfolio.openPositions.map((position) => position.id), ["position:candle-0"]);
  });

  test("uses only each historical prefix and is reproducible", () => {
    const original = run();
    const changedFuture = timeline.map((item, index) => index === 3
      ? { ...item, open: "999", high: "1001", low: "998", close: "1000" }
      : item);
    const rerun = run(changedFuture);
    assert.deepEqual(rerun.decisions.slice(0, 3), original.decisions.slice(0, 3));
    assert.deepEqual(run(), original);
    assert.deepEqual(original.events.map((event) => event.sequenceNumber),
      Array.from({ length: original.events.length }, (_, index) => index + 1));
  });

  test("uses pre-range candles only as indicator warm-up", () => {
    const candles = [candle(0, "100", "100"), candle(1, "100", "99"), candle(2, "99", "98")];
    const strategy: StrategyDefinitionV1 = {
      schemaVersion: 1,
      name: "Warm RSI",
      entry: { indicator: "RSI", period: 2, operator: "LT", value: 1 },
      exit: { indicator: "RSI", period: 2, operator: "GT", value: 100 },
    };
    const result = runHistoricalBacktest({ definition: strategy, candles,
      backtestFrom: candles[2].openTime, backtestTo: candles[2].openTime, execution });
    assert.deepEqual(result.evaluatedCandleIds, [candles[2].id]);
    assert.equal(result.decisions[0].evaluation.action, "BUY");
    assert.equal(result.decisions[0].evaluation.entry.reasonCode, "RSI_MATCHED");
    assert.equal(result.portfolio.openPositions.length, 0);
    assert.equal(result.events.at(-1)?.eventType, "UNFILLED_AT_END_OF_RANGE");
  });

  test("rejects malformed ranges and unsafe candle histories", () => {
    assert.throws(() => runHistoricalBacktest({ definition: sequenceStrategy, candles: timeline,
      backtestFrom: timeline[2].openTime, backtestTo: timeline[1].openTime, execution }),
      HistoricalBacktestInputError);
    assert.throws(() => run([timeline[0], { ...timeline[1], isClosed: false }, ...timeline.slice(2)]),
      /must be closed/);
    assert.throws(() => run([timeline[1], timeline[0], ...timeline.slice(2)]),
      /strictly ordered/);
    assert.throws(() => run([{ ...timeline[0], pairSymbol: "ETHUSDC" }, ...timeline.slice(1)]),
      /one market/);
    const overlapping = timeline.map((item, index) => index === 0
      ? { ...item, closeTime: new Date(timeline[1].closeTime.getTime() + 1) } : item);
    assert.throws(() => run(overlapping), /future close at evaluation time/);
  });

  test("keeps BUY decisions but rejects execution when all cash is reserved or invested", () => {
    const alwaysGreen = Array.from({ length: 7 }, (_, index) => candle(index, "100", "101"));
    const result = run(alwaysGreen);
    assert.equal(result.portfolio.openPositions.length, 5);
    assert.equal(result.portfolio.cash, "5");
    assert.ok(result.decisions.some((decision) => decision.executionOutcome === "ENTRY_REJECTED" &&
      decision.executionReason === "INSUFFICIENT_AVAILABLE_CASH"));
    assert.ok(result.events.some((event) => event.eventType === "ENTRY_REJECTED"));
  });

  test("ON_FALSE_TO_TRUE opens only once during a continuous matching episode", () => {
    const alwaysGreen = Array.from({ length: 7 }, (_, index) => candle(index, "100", "101"));
    const result = runHistoricalBacktest({ definition: { ...sequenceStrategy,
      entryPolicy: { trigger: "ON_FALSE_TO_TRUE" } }, candles: alwaysGreen,
      backtestFrom: alwaysGreen[0].openTime, backtestTo: alwaysGreen.at(-1)!.openTime, execution });
    assert.equal(result.portfolio.openPositions.length, 1);
    assert.equal(result.fills.filter((fill) => fill.side === "BUY").length, 1);
    assert.equal(result.decisions.filter((decision) => decision.executionOutcome === "ENTRY_SUPPRESSED").length, 6);
    assert.ok(result.events.some((event) => event.eventType === "ENTRY_SUPPRESSED"));
  });

  test("EVERY_MATCHING_CANDLE honors cooldown after each filled entry", () => {
    const alwaysGreen = Array.from({ length: 7 }, (_, index) => candle(index, "100", "101"));
    const result = runHistoricalBacktest({ definition: { ...sequenceStrategy,
      entryPolicy: { trigger: "EVERY_MATCHING_CANDLE", cooldownCandles: 2 } }, candles: alwaysGreen,
      backtestFrom: alwaysGreen[0].openTime, backtestTo: alwaysGreen.at(-1)!.openTime, execution });
    assert.equal(result.fills.filter((fill) => fill.side === "BUY").length, 2);
    assert.ok(result.decisions.some((decision) => decision.executionReason === "ENTRY_COOLDOWN_ACTIVE"));
  });

  test("minimal logging retains only fill decisions and the final portfolio snapshot", () => {
    const result = runHistoricalBacktest({ definition: sequenceStrategy, candles: timeline,
      backtestFrom: timeline[0].openTime, backtestTo: timeline.at(-1)!.openTime, execution,
      includeFullTimeline: false });
    assert.equal(result.snapshots.length, 1);
    assert.equal(result.decisions.length, 3);
    assert.equal(result.events.length, result.decisions.length);
    assert.ok(result.events.every((event) => event.eventType === "DECISION_MADE"));
    assert.ok(result.fills.every((fill) => fill.decisionCandleId &&
      result.decisions.some((decision) => decision.candleId === fill.decisionCandleId)));
    assert.deepEqual(result.actionCounts, { HOLD: 0, BUY: 3, SELL: 1 });
  });
});
