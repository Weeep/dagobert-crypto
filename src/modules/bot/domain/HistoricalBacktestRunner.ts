import type { Candle } from "@/src/modules/market";
import Big from "big.js";
import {
  createHistoricalIndicatorCache,
  evaluateValidatedHistoricalStrategy,
  validateStrategyDefinition,
  type StrategyDefinitionV1,
  type StrategyEvaluation,
} from "@/src/modules/strategy";
import {
  closeSelectedBacktestPositions,
  createBacktestPortfolio,
  fillBacktestEntry,
  releaseBacktestEntry,
  reserveBacktestEntry,
  snapshotBacktestPortfolio,
  validateBacktestExecutionConfig,
  type BacktestExecutionConfig,
  type BacktestFill,
  type BacktestPortfolio,
  type BacktestPortfolioSnapshot,
} from "./BacktestPortfolio";
import { applyEntryTriggerPolicy, type EntryTriggerState } from "./EntryTriggerPolicy";

export type HistoricalBacktestInput = {
  definition: StrategyDefinitionV1;
  candles: readonly Candle[];
  backtestFrom: Date;
  backtestTo: Date;
  execution: BacktestExecutionConfig;
  /** Retains every decision/event/snapshot. Defaults to true for direct domain callers. */
  includeFullTimeline?: boolean;
  onProgress?: (progress: HistoricalBacktestProgress) => void;
};

export type HistoricalBacktestProgress = {
  phase: "LOADING" | "EVALUATING" | "SAVING";
  processedCandles: number;
  totalCandles: number;
  loadedCandles?: number;
  currentCandleOpenTime?: string;
  currentOperation?: string;
  percent: number;
  decisions: { HOLD: number; BUY: number; SELL: number };
};

export type HistoricalBacktestDecision = {
  candleId: string;
  evaluation: StrategyEvaluation;
  executionOutcome: "HOLD" | "ENTRY_RESERVED" | "ENTRY_REJECTED" | "ENTRY_SUPPRESSED" | "EXIT_SCHEDULED";
  executionReason: string;
};

export type HistoricalBacktestEvent = {
  sequenceNumber: number;
  eventType:
    | "DECISION_MADE"
    | "ENTRY_RESERVED"
    | "ENTRY_REJECTED"
    | "ENTRY_SUPPRESSED"
    | "ENTRY_FILLED"
    | "EXIT_SCHEDULED"
    | "POSITIONS_CLOSED"
    | "UNFILLED_AT_END_OF_RANGE";
  candleId: string;
  occurredAt: string;
  payload: unknown;
};

export type HistoricalBacktestSnapshot = {
  candleId: string;
  capturedAt: string;
  portfolio: BacktestPortfolioSnapshot;
};

export type HistoricalBacktestResult = {
  portfolio: BacktestPortfolio;
  decisions: HistoricalBacktestDecision[];
  fills: BacktestFill[];
  events: HistoricalBacktestEvent[];
  snapshots: HistoricalBacktestSnapshot[];
  evaluatedCandleIds: string[];
  actionCounts: { HOLD: number; BUY: number; SELL: number };
  maximumDrawdownPct: string;
};

type PendingDecision = { decision?: HistoricalBacktestDecision; decisionCandle?: Candle };
type PendingExecution =
  | ({ side: "BUY"; decisionCandleId: string; reservationId: string; positionId: string } & PendingDecision)
  | ({ side: "SELL"; decisionCandleId: string; positionIds: string[] } & PendingDecision);

export class HistoricalBacktestInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HistoricalBacktestInputError";
    Object.setPrototypeOf(this, HistoricalBacktestInputError.prototype);
  }
}

const validDate = (value: Date) => value instanceof Date && Number.isFinite(value.getTime());

function validateHistoricalInput(input: HistoricalBacktestInput) {
  if (!validDate(input.backtestFrom) || !validDate(input.backtestTo) ||
      input.backtestFrom.getTime() > input.backtestTo.getTime())
    throw new HistoricalBacktestInputError("backtest range must contain valid ascending dates");
  if (!validateStrategyDefinition(input.definition).ok)
    throw new HistoricalBacktestInputError("strategy definition is invalid or unsupported");
  validateBacktestExecutionConfig(input.execution);
  if (input.candles.length === 0) throw new HistoricalBacktestInputError("historical candles are required");

  const first = input.candles[0];
  let previousOpen = Number.NEGATIVE_INFINITY;
  const ids = new Set<string>();
  for (const candle of input.candles) {
    if (!candle.isClosed) throw new HistoricalBacktestInputError("historical candles must be closed");
    if (candle.pairSymbol !== first.pairSymbol || candle.interval !== first.interval)
      throw new HistoricalBacktestInputError("historical candles must use one market and interval");
    const open = candle.openTime.getTime();
    const close = candle.closeTime.getTime();
    if (!Number.isFinite(open) || !Number.isFinite(close) || close < open)
      throw new HistoricalBacktestInputError("historical candle timestamps must be valid");
    if (open <= previousOpen || ids.has(candle.id))
      throw new HistoricalBacktestInputError("historical candles must be strictly ordered and unique");
    ids.add(candle.id);
    previousOpen = open;
  }
  const evaluationIndexes = input.candles
    .map((candle, index) => ({ candle, index }))
    .filter(({ candle }) => candle.openTime.getTime() >= input.backtestFrom.getTime() &&
      candle.openTime.getTime() <= input.backtestTo.getTime());
  if (evaluationIndexes.length === 0)
    throw new HistoricalBacktestInputError("backtest range does not contain a candle");
  return evaluationIndexes;
}

/**
 * Runs one deterministic in-memory timeline. Candle prefixes end at the candle
 * being evaluated; only a previously scheduled intent may use the next open.
 */
function* historicalBacktestSteps(input: HistoricalBacktestInput): Generator<HistoricalBacktestProgress, HistoricalBacktestResult> {
  const evaluationIndexes = validateHistoricalInput(input);
  const includeFullTimeline = input.includeFullTimeline ?? true;
  const indicatorCache = createHistoricalIndicatorCache(input.candles);
  const evaluationIndexSet = new Set(evaluationIndexes.map(({ index }) => index));
  const lastEvaluationIndex = evaluationIndexes.at(-1)!.index;
  let portfolio = createBacktestPortfolio(input.execution);
  let pending: PendingExecution | null = null;
  let entryTriggerState: EntryTriggerState = { previousEntryMatched: false, lastEntryFillIndex: null };
  let sequenceNumber = 0;
  const decisions: HistoricalBacktestDecision[] = [];
  const fills: BacktestFill[] = [];
  const events: HistoricalBacktestEvent[] = [];
  const snapshots: HistoricalBacktestSnapshot[] = [];
  const actionCounts = { HOLD: 0, BUY: 0, SELL: 0 };
  let peakEquity = new Big(portfolio.initialCash);
  let maximumDrawdownPct = new Big(0);
  let lastSnapshot: HistoricalBacktestSnapshot | null = null;
  const event = (eventType: HistoricalBacktestEvent["eventType"], candle: Candle, payload: unknown,
    occurredAt: Date, force = false) => {
    if (!includeFullTimeline && !force) return;
    events.push({ sequenceNumber: ++sequenceNumber, eventType, candleId: candle.id,
      occurredAt: occurredAt.toISOString(), payload });
  };
  const snapshot = (candle: Candle) => {
    const current: HistoricalBacktestSnapshot = { candleId: candle.id,
      capturedAt: candle.closeTime.toISOString(), portfolio: snapshotBacktestPortfolio(portfolio, candle.close) };
    const equity = new Big(current.portfolio.totalEquity);
    if (equity.gt(peakEquity)) peakEquity = equity;
    if (peakEquity.gt(0)) {
      const drawdown = peakEquity.minus(equity).div(peakEquity).times(100);
      if (drawdown.gt(maximumDrawdownPct)) maximumDrawdownPct = drawdown;
    }
    lastSnapshot = current;
    if (includeFullTimeline) snapshots.push(current);
  };
  const retainPendingDecision = (execution: PendingExecution) => {
    if (includeFullTimeline || !execution.decision || !execution.decisionCandle) return;
    decisions.push(execution.decision);
    event("DECISION_MADE", execution.decisionCandle, execution.decision,
      execution.decisionCandle.closeTime, true);
  };

  for (let index = evaluationIndexes[0].index; index <= lastEvaluationIndex; index += 1) {
    const candle = input.candles[index];
    if (!evaluationIndexSet.has(index)) continue;

    if (pending?.side === "BUY") {
      retainPendingDecision(pending);
      const result = fillBacktestEntry(portfolio, input.execution, {
        reservationId: pending.reservationId,
        positionId: pending.positionId,
        nextOpen: candle.open,
        filledAt: candle.openTime,
      });
      portfolio = result.portfolio;
      entryTriggerState = { ...entryTriggerState, lastEntryFillIndex: index };
      fills.push({ ...result.fill, decisionCandleId: pending.decisionCandleId });
      event("ENTRY_FILLED", candle, { decisionCandleId: pending.decisionCandleId, fill: result.fill }, candle.openTime);
      pending = null;
    } else if (pending?.side === "SELL") {
      retainPendingDecision(pending);
      const result = closeSelectedBacktestPositions(portfolio, input.execution, {
        positionIds: pending.positionIds,
        nextOpen: candle.open,
        filledAt: candle.openTime,
      });
      portfolio = result.portfolio;
      const decisionCandleId = pending.decisionCandleId;
      fills.push(...result.fills.map((fill) => ({ ...fill, decisionCandleId })));
      event("POSITIONS_CLOSED", candle,
        { decisionCandleId: pending.decisionCandleId, fills: result.fills,
          positionIds: result.positions.map((position) => position.id) }, candle.openTime);
      pending = null;
    }

    const evaluation = evaluateValidatedHistoricalStrategy({
      definition: input.definition,
      candles: input.candles,
      candleIndex: index,
      indicatorCache,
      evaluatedCandle: candle,
      position: { hasOpenPositions: portfolio.openPositions.length > 0,
        openPositionCount: portfolio.openPositions.length,
        exitFeeRate: input.execution.feeRate,
        positions: portfolio.openPositions.map((position) => ({
          id: position.id, entryPrice: position.entryPrice, quantity: position.quantity,
          entryCost: position.entryNotional, entryFees: position.entryFee,
          openedAt: position.openedAt,
        })) },
    });
    let executionOutcome: HistoricalBacktestDecision["executionOutcome"] = "HOLD";
    let executionReason = evaluation.reasonCode;
    let executionEvent: { type: HistoricalBacktestEvent["eventType"]; payload: unknown } | null = null;
    const entryTrigger = applyEntryTriggerPolicy(input.definition.entryPolicy, entryTriggerState,
      evaluation.entry.matched, index);
    entryTriggerState = entryTrigger.state;
    if (evaluation.action === "BUY" && !entryTrigger.allowed) {
      executionOutcome = "ENTRY_SUPPRESSED";
      executionReason = entryTrigger.reason;
      executionEvent = { type: "ENTRY_SUPPRESSED", payload: { reason: entryTrigger.reason,
        policy: input.definition.entryPolicy ?? null } };
    } else if (evaluation.action === "BUY") {
      const reservationId = `entry:${candle.id}`;
      const reserved = reserveBacktestEntry(portfolio, input.execution, reservationId);
      if (reserved.ok) {
        portfolio = reserved.portfolio;
        pending = { side: "BUY", decisionCandleId: candle.id, reservationId,
          positionId: `position:${candle.id}` };
        executionOutcome = "ENTRY_RESERVED";
        executionReason = "ENTRY_RESERVED_FOR_NEXT_OPEN";
        executionEvent = { type: "ENTRY_RESERVED", payload: { reservation: reserved.reservation } };
      } else {
        executionOutcome = "ENTRY_REJECTED";
        executionReason = reserved.reason;
        executionEvent = { type: "ENTRY_REJECTED", payload: { reason: reserved.reason } };
      }
    } else if (evaluation.action === "SELL") {
      pending = { side: "SELL", decisionCandleId: candle.id,
        positionIds: [...evaluation.selectedPositionIds] };
      executionOutcome = "EXIT_SCHEDULED";
      executionReason = "EXIT_SCHEDULED_FOR_NEXT_OPEN";
      executionEvent = { type: "EXIT_SCHEDULED",
        payload: { positionIds: evaluation.selectedPositionIds } };
    }
    const decision = { candleId: candle.id, evaluation, executionOutcome, executionReason };
    if (includeFullTimeline) decisions.push(decision);
    if (pending?.decisionCandleId === candle.id)
      pending = { ...pending, decision, decisionCandle: candle } as PendingExecution;
    actionCounts[evaluation.action] += 1;
    const processedCandles = index - evaluationIndexes[0].index + 1;
    const progress: HistoricalBacktestProgress = { phase: "EVALUATING", processedCandles,
      totalCandles: evaluationIndexes.length, currentCandleOpenTime: candle.openTime.toISOString(),
      percent: Math.round((processedCandles / evaluationIndexes.length) * 100), decisions: { ...actionCounts } };
    input.onProgress?.(progress);
    yield progress;
    event("DECISION_MADE", candle, decision, candle.closeTime);
    if (executionEvent) event(executionEvent.type, candle, executionEvent.payload, candle.closeTime);
    snapshot(candle);
  }

  if (pending) {
    const finalCandle = input.candles[lastEvaluationIndex];
    if (pending.side === "BUY") {
      portfolio = releaseBacktestEntry(portfolio, pending.reservationId);
      snapshot(finalCandle);
    }
    event("UNFILLED_AT_END_OF_RANGE", finalCandle,
      { decisionCandleId: pending.decisionCandleId, side: pending.side }, finalCandle.closeTime);
  }
  if (!includeFullTimeline && lastSnapshot) snapshots.push(lastSnapshot);
  return { portfolio, decisions, fills, events, snapshots,
    evaluatedCandleIds: evaluationIndexes.map(({ candle }) => candle.id), actionCounts,
    maximumDrawdownPct: maximumDrawdownPct.toString() };
}

export function runHistoricalBacktest(input: HistoricalBacktestInput): HistoricalBacktestResult {
  const steps = historicalBacktestSteps(input);
  while (true) { const step = steps.next(); if (step.done) return step.value; }
}

/** Yields periodically so HTTP progress chunks and other event-loop work can be flushed. */
export async function runHistoricalBacktestAsync(input: HistoricalBacktestInput): Promise<HistoricalBacktestResult> {
  const steps = historicalBacktestSteps(input); let processed = 0;
  while (true) {
    const step = steps.next(); if (step.done) return step.value;
    processed += 1;
    if (processed % 25 === 0) await new Promise<void>((resolve) => setImmediate(resolve));
  }
}
