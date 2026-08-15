import type { Candle } from "@/src/modules/market";
import {
  evaluateStrategy,
  validateStrategyDefinition,
  type StrategyDefinitionV1,
  type StrategyEvaluation,
} from "@/src/modules/strategy";
import {
  closeAllBacktestPositions,
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

export type HistoricalBacktestInput = {
  definition: StrategyDefinitionV1;
  candles: readonly Candle[];
  backtestFrom: Date;
  backtestTo: Date;
  execution: BacktestExecutionConfig;
};

export type HistoricalBacktestDecision = {
  candleId: string;
  evaluation: StrategyEvaluation;
  executionOutcome: "HOLD" | "ENTRY_RESERVED" | "ENTRY_REJECTED" | "EXIT_SCHEDULED";
  executionReason: string;
};

export type HistoricalBacktestEvent = {
  sequenceNumber: number;
  eventType:
    | "DECISION_MADE"
    | "ENTRY_RESERVED"
    | "ENTRY_REJECTED"
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
};

type PendingExecution =
  | { side: "BUY"; decisionCandleId: string; reservationId: string; positionId: string }
  | { side: "SELL"; decisionCandleId: string };

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
export function runHistoricalBacktest(input: HistoricalBacktestInput): HistoricalBacktestResult {
  const evaluationIndexes = validateHistoricalInput(input);
  const evaluationIndexSet = new Set(evaluationIndexes.map(({ index }) => index));
  const lastEvaluationIndex = evaluationIndexes.at(-1)!.index;
  let portfolio = createBacktestPortfolio(input.execution);
  let pending: PendingExecution | null = null;
  let sequenceNumber = 0;
  const decisions: HistoricalBacktestDecision[] = [];
  const fills: BacktestFill[] = [];
  const events: HistoricalBacktestEvent[] = [];
  const snapshots: HistoricalBacktestSnapshot[] = [];
  const event = (eventType: HistoricalBacktestEvent["eventType"], candle: Candle, payload: unknown, occurredAt: Date) => {
    events.push({ sequenceNumber: ++sequenceNumber, eventType, candleId: candle.id,
      occurredAt: occurredAt.toISOString(), payload });
  };

  for (let index = evaluationIndexes[0].index; index <= lastEvaluationIndex; index += 1) {
    const candle = input.candles[index];
    if (!evaluationIndexSet.has(index)) continue;

    if (pending?.side === "BUY") {
      const result = fillBacktestEntry(portfolio, input.execution, {
        reservationId: pending.reservationId,
        positionId: pending.positionId,
        nextOpen: candle.open,
        filledAt: candle.openTime,
      });
      portfolio = result.portfolio;
      fills.push(result.fill);
      event("ENTRY_FILLED", candle, { decisionCandleId: pending.decisionCandleId, fill: result.fill }, candle.openTime);
      pending = null;
    } else if (pending?.side === "SELL") {
      const result = closeAllBacktestPositions(portfolio, input.execution, {
        nextOpen: candle.open,
        filledAt: candle.openTime,
      });
      portfolio = result.portfolio;
      fills.push(...result.fills);
      event("POSITIONS_CLOSED", candle,
        { decisionCandleId: pending.decisionCandleId, fills: result.fills,
          positionIds: result.positions.map((position) => position.id) }, candle.openTime);
      pending = null;
    }

    const evaluation = evaluateStrategy({
      definition: input.definition,
      candles: input.candles.slice(0, index + 1),
      evaluatedCandle: candle,
      position: { hasOpenPositions: portfolio.openPositions.length > 0,
        openPositionCount: portfolio.openPositions.length },
    });
    let executionOutcome: HistoricalBacktestDecision["executionOutcome"] = "HOLD";
    let executionReason = evaluation.reasonCode;
    let executionEvent: { type: HistoricalBacktestEvent["eventType"]; payload: unknown } | null = null;
    if (evaluation.action === "BUY") {
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
      pending = { side: "SELL", decisionCandleId: candle.id };
      executionOutcome = "EXIT_SCHEDULED";
      executionReason = "EXIT_SCHEDULED_FOR_NEXT_OPEN";
      executionEvent = { type: "EXIT_SCHEDULED",
        payload: { positionIds: portfolio.openPositions.map((position) => position.id) } };
    }
    const decision = { candleId: candle.id, evaluation, executionOutcome, executionReason };
    decisions.push(decision);
    event("DECISION_MADE", candle, decision, candle.closeTime);
    if (executionEvent) event(executionEvent.type, candle, executionEvent.payload, candle.closeTime);
    snapshots.push({ candleId: candle.id, capturedAt: candle.closeTime.toISOString(),
      portfolio: snapshotBacktestPortfolio(portfolio, candle.close) });
  }

  if (pending) {
    const finalCandle = input.candles[lastEvaluationIndex];
    if (pending.side === "BUY") {
      portfolio = releaseBacktestEntry(portfolio, pending.reservationId);
      snapshots.push({ candleId: finalCandle.id, capturedAt: finalCandle.closeTime.toISOString(),
        portfolio: snapshotBacktestPortfolio(portfolio, finalCandle.close) });
    }
    event("UNFILLED_AT_END_OF_RANGE", finalCandle,
      { decisionCandleId: pending.decisionCandleId, side: pending.side }, finalCandle.closeTime);
  }
  return { portfolio, decisions, fills, events, snapshots,
    evaluatedCandleIds: evaluationIndexes.map(({ candle }) => candle.id) };
}
