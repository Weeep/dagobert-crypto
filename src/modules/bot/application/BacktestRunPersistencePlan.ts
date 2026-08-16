import Big from "big.js";
import { v5 as uuidv5 } from "uuid";
import type { BacktestClosedPosition, BacktestOpenPosition } from "../domain/BacktestPortfolio";
import type { HistoricalBacktestResult } from "../domain/HistoricalBacktestRunner";

const SCALE = 18;
const id = (runId: string, identity: string) => uuidv5(`${runId}:${identity}`, uuidv5.URL);
const money = (value: string | Big) => new Big(value).round(SCALE, Big.roundHalfUp).toFixed();
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown;

export type BacktestPersistencePlan = ReturnType<typeof buildBacktestPersistencePlan>;

/** Maps a pure runner result to stable, database-scale trading records. */
export function buildBacktestPersistencePlan(runId: string, result: HistoricalBacktestResult) {
  const positionId = new Map<string, string>();
  const allPositions: Array<BacktestClosedPosition | BacktestOpenPosition> =
    [...result.portfolio.closedPositions, ...result.portfolio.openPositions];
  for (const position of allPositions)
    positionId.set(position.id, id(runId, `position:${position.id}`));

  const positions = allPositions.map((position) => {
    const closed = "closedAt" in position;
    const buyFill = result.fills.find((fill) => fill.positionId === position.id && fill.side === "BUY");
    const sellFill = result.fills.find((fill) => fill.positionId === position.id && fill.side === "SELL");
    if (!buyFill || (closed && !sellFill)) throw new Error(`position fills are incomplete: ${position.id}`);
    const entryNotional = new Big(money(buyFill.notional));
    const entryFee = new Big(money(buyFill.fee));
    const exitNotional = sellFill ? new Big(money(sellFill.notional)) : new Big(0);
    const exitFee = sellFill ? new Big(money(sellFill.fee)) : new Big(0);
    return {
      id: positionId.get(position.id)!, botRunId: runId, status: closed ? "CLOSED" as const : "OPEN" as const,
      entryCost: money(entryNotional), entryQuantity: money(position.quantity),
      remainingQuantity: closed ? "0" : money(position.quantity), averageEntryPrice: money(position.entryPrice),
      averageExitPrice: closed ? money(position.exitPrice) : null,
      fees: money(entryFee.plus(exitFee)),
      realizedPnl: closed ? money(exitNotional.minus(exitFee).minus(entryNotional).minus(entryFee)) : "0",
      openedAt: new Date(position.openedAt),
      closedAt: closed ? new Date(position.closedAt) : null,
    };
  });

  let balance = new Big(result.portfolio.initialCash);
  const orders: Array<{ id: string; botRunId: string; positionId: string; idempotencyKey: string;
    side: "BUY" | "SELL"; requestedQuoteAmount: string | null; requestedQuantity: string | null;
    executedQuantity: string; submittedAt: Date }> = [];
  const fills: Array<{ id: string; botOrderId: string; exchangeTradeId: string; quantity: string;
    price: string; commission: string; commissionAsset: string; filledAt: Date }> = [];
  const ledgerEntries: Array<{ id: string; botRunId: string; type: "BUY_COST" | "SELL_PROCEEDS" | "FEE" | "CORRECTION";
    amount: string; balanceAfter: string; referenceType: string; referenceId: string;
    description: string; occurredAt: Date }> = [];
  result.fills.forEach((fill, index) => {
    const persistedPositionId = positionId.get(fill.positionId);
    if (!persistedPositionId) throw new Error(`fill position is missing: ${fill.positionId}`);
    const orderId = id(runId, `order:${fill.side}:${fill.positionId}`);
    const filledAt = new Date(fill.filledAt);
    const notional = new Big(money(fill.notional));
    const fee = new Big(money(fill.fee));
    orders.push({ id: orderId, botRunId: runId, positionId: persistedPositionId,
      idempotencyKey: `backtest:${runId}:${fill.side}:${fill.positionId}`, side: fill.side,
      requestedQuoteAmount: fill.side === "BUY" ? money(notional.plus(fee)) : null,
      requestedQuantity: fill.side === "SELL" ? money(fill.quantity) : null,
      executedQuantity: money(fill.quantity), submittedAt: filledAt });
    fills.push({ id: id(runId, `fill:${fill.side}:${fill.positionId}`), botOrderId: orderId,
      exchangeTradeId: `BACKTEST:${fill.side}:${fill.positionId}`, quantity: money(fill.quantity),
      price: money(fill.price), commission: money(fee), commissionAsset: "USDC", filledAt });
    const cashAmount = fill.side === "BUY" ? notional.times(-1) : notional;
    balance = balance.plus(cashAmount);
    ledgerEntries.push({ id: id(runId, `ledger:${index}:cash`), botRunId: runId,
      type: fill.side === "BUY" ? "BUY_COST" : "SELL_PROCEEDS", amount: money(cashAmount),
      balanceAfter: money(balance), referenceType: "BOT_ORDER", referenceId: orderId,
      description: fill.side === "BUY" ? "Backtest buy fill cost" : "Backtest sell fill proceeds",
      occurredAt: filledAt });
    if (!fee.eq(0)) {
      balance = balance.minus(fee);
      ledgerEntries.push({ id: id(runId, `ledger:${index}:fee`), botRunId: runId, type: "FEE",
        amount: money(fee.times(-1)), balanceAfter: money(balance), referenceType: "BOT_ORDER",
        referenceId: orderId, description: `Backtest ${fill.side.toLowerCase()} fill fee`, occurredAt: filledAt });
    }
  });
  const expectedCash = new Big(money(result.portfolio.cash));
  const scaleDifference = expectedCash.minus(balance);
  const maximumScaleDifference = new Big(10).pow(-SCALE).times(result.fills.length * 2 + 1);
  if (scaleDifference.abs().gt(maximumScaleDifference))
    throw new Error("runner cash does not reconcile with generated ledger entries");
  if (!scaleDifference.eq(0)) {
    balance = expectedCash;
    ledgerEntries.push({ id: id(runId, "ledger:scale-correction"), botRunId: runId, type: "CORRECTION",
      amount: money(scaleDifference), balanceAfter: money(balance), referenceType: "BOT_RUN",
      referenceId: runId, description: "Backtest database decimal scale reconciliation",
      occurredAt: new Date(result.events.at(-1)!.occurredAt) });
  }

  const decisions = result.decisions.map((decision) => {
    const event = result.events.find((candidate) => candidate.eventType === "DECISION_MADE" &&
      candidate.candleId === decision.candleId);
    if (!event) throw new Error(`decision event is missing: ${decision.candleId}`);
    return { id: id(runId, `decision:${decision.candleId}`), botRunId: runId,
      candleId: decision.candleId, action: decision.evaluation.action,
      reasonCode: decision.evaluation.reasonCode, explanation: decision.evaluation.explanation,
      inputs: json({ position: decision.evaluation.position, executionOutcome: decision.executionOutcome,
        executionReason: decision.executionReason }), output: json(decision.evaluation),
      evaluatedAt: new Date(event.occurredAt) };
  });
  const indicatorSnapshots = result.decisions.map((decision) => ({
    id: id(runId, `indicator:${decision.candleId}`), botRunId: runId, candleId: decision.candleId,
    values: json({ entry: decision.evaluation.entry, exit: decision.evaluation.exit }),
    calculatedAt: decisions.find((item) => item.candleId === decision.candleId)!.evaluatedAt,
  }));
  const candleOpenTimes = new Map(result.decisions.map((decision) =>
    [decision.candleId, decision.evaluation.evaluatedCandleOpenTime]));
  const events = result.events.map((event) => ({ id: id(runId, `event:${event.sequenceNumber}`),
    botRunId: runId, sequenceNumber: BigInt(event.sequenceNumber), eventType: event.eventType,
    candleOpenTime: candleOpenTimes.get(event.candleId) ?? null, payload: json(event.payload),
    occurredAt: new Date(event.occurredAt) }));
  const portfolioSnapshots = result.snapshots.map((snapshot, index) => ({
    id: id(runId, `portfolio:${index + 1}`), botRunId: runId, sequenceNumber: BigInt(index + 1),
    availableBudget: money(snapshot.portfolio.availableCash), reservedBudget: money(snapshot.portfolio.reservedCash),
    investedCost: money(snapshot.portfolio.investedCost), marketValue: money(snapshot.portfolio.marketValue),
    realizedPnl: money(snapshot.portfolio.realizedPnl), unrealizedPnl: money(snapshot.portfolio.unrealizedPnl),
    totalEquity: money(snapshot.portfolio.totalEquity), capturedAt: new Date(snapshot.capturedAt),
  }));
  const endedAt = new Date(Math.max(
    ...result.events.map((event) => new Date(event.occurredAt).getTime()),
    ...result.snapshots.map((snapshot) => new Date(snapshot.capturedAt).getTime()),
  ));
  return { positions, orders, fills, ledgerEntries, decisions, indicatorSnapshots, events,
    portfolioSnapshots, endedAt };
}
