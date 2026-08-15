import assert from "node:assert/strict";
import test from "node:test";
import Big from "big.js";
import type { Candle } from "@/src/modules/market";
import { buildBacktestPersistencePlan, runHistoricalBacktest } from "@/src/modules/bot";
import type { StrategyDefinitionV1 } from "@/src/modules/strategy";

const candle = (index: number, open: string, close: string): Candle => {
  const openTime = new Date(Date.UTC(2026, 1, 1, index));
  return { id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    pairSymbol: "BTCUSDC", interval: "1h", openTime,
    closeTime: new Date(openTime.getTime() + 3_599_999), open,
    high: String(Math.max(Number(open), Number(close)) + 1),
    low: String(Math.min(Number(open), Number(close)) - 1), close, volume: "1",
    quoteVolume: "100", trades: 1, source: "TEST", isClosed: true,
    receivedAt: new Date(openTime.getTime() + 3_600_000) };
};
const strategy: StrategyDefinitionV1 = { schemaVersion: 1, name: "Persistence",
  entry: { candleSequence: { count: 1, direction: "GREEN", minimumBodyChangePct: 0 } },
  exit: { candleSequence: { count: 1, direction: "RED", minimumBodyChangePct: 0 } } };
const candles = [candle(0, "100", "101"), candle(1, "102", "103"),
  candle(2, "104", "100"), candle(3, "110", "112")];
const result = () => runHistoricalBacktest({ definition: strategy, candles,
  backtestFrom: candles[0].openTime, backtestTo: candles.at(-1)!.openTime,
  execution: { assignedBudget: "55", amountPerPosition: "10", feeRate: "0.001", slippageRate: "0.005" } });

test("backtest persistence plan is stable, relational, and reconciled at database precision", () => {
  const runId = "10000000-0000-4000-8000-000000000001";
  const plan = buildBacktestPersistencePlan(runId, result());
  assert.deepEqual(buildBacktestPersistencePlan(runId, result()), plan);
  assert.equal(plan.positions.length, 2);
  assert.equal(plan.orders.length, 4);
  assert.equal(plan.fills.length, 4);
  assert.ok(plan.ledgerEntries.length === 8 || plan.ledgerEntries.length === 9);
  assert.equal(plan.decisions.length, 4);
  assert.equal(plan.indicatorSnapshots.length, 4);
  assert.equal(plan.portfolioSnapshots.length, 5);
  assert.ok(plan.positions.every((position) => /^[0-9a-f-]{36}$/.test(position.id)));
  assert.ok(plan.orders.every((order) => plan.positions.some((position) => position.id === order.positionId)));
  assert.ok(plan.fills.every((fill) => plan.orders.some((order) => order.id === fill.botOrderId)));
  for (const position of plan.positions) {
    const positionOrders = plan.orders.filter((order) => order.positionId === position.id);
    const positionFills = plan.fills.filter((fill) => positionOrders.some((order) => order.id === fill.botOrderId));
    assert.equal(position.fees, positionFills.reduce((total, fill) => total.plus(fill.commission), new Big(0)).toFixed());
  }
  assert.equal(plan.ledgerEntries.at(-1)?.balanceAfter,
    new Big(result().portfolio.cash).round(18, Big.roundHalfUp).toFixed());
  assert.deepEqual(plan.events.map((event) => event.sequenceNumber),
    Array.from({ length: plan.events.length }, (_, index) => BigInt(index + 1)));
  assert.deepEqual(plan.portfolioSnapshots.map((snapshot) => snapshot.sequenceNumber),
    [1, 2, 3, 4, 5].map(BigInt));
});

test("backtest persistence plan rejects detached fills and cash drift", () => {
  const runId = "10000000-0000-4000-8000-000000000002";
  const detached = result();
  detached.fills[0] = { ...detached.fills[0], positionId: "missing" };
  assert.throws(() => buildBacktestPersistencePlan(runId, detached), /fills are incomplete|fill position is missing/);
  const drifted = result();
  drifted.portfolio.cash = "999";
  assert.throws(() => buildBacktestPersistencePlan(runId, drifted), /does not reconcile/);
});
