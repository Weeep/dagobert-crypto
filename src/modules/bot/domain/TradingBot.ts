import type { MarketInterval } from "@/src/shared/domain/MarketInterval";
import { MARKET_INTERVALS } from "@/src/shared/domain/MarketInterval";

/** Compatibility name for bot callers; the shared market list is authoritative. */
export const BOT_TIMEFRAMES = MARKET_INTERVALS;
export type BotTimeframe = MarketInterval;
export type BotMode = "BACKTEST" | "PAPER" | "SPOT_TEST" | "SPOT_LIVE";
export type BotStatus = "DRAFT" | "RUNNING" | "PAUSED" | "STOPPED" | "ERROR";
export type BotRunStatus = "RUNNING" | "COMPLETED" | "STOPPED" | "ERROR";
export type BotAction = "BUY" | "SELL" | "HOLD";
export type PositionStatus = "OPENING" | "OPEN" | "CLOSING" | "CLOSED" | "ERROR";
export type BotOrderStatus =
  | "PENDING"
  | "SUBMITTED"
  | "PARTIALLY_FILLED"
  | "FILLED"
  | "CANCELED"
  | "REJECTED"
  | "RECONCILIATION_REQUIRED";
export type LedgerEntryType =
  | "ALLOCATION"
  | "RESERVE"
  | "RELEASE"
  | "BUY_COST"
  | "SELL_PROCEEDS"
  | "FEE"
  | "CORRECTION";

export type TradingBot = {
  id: string;
  userId: string;
  name: string;
  pairSymbol: string;
  assignedBudget: string;
  amountPerPosition: string;
  timeframe: BotTimeframe;
  mode: BotMode;
  status: BotStatus;
  strategyVersionId: string;
  feeRate: string;
  slippageRate: string;
  createdAt: Date;
  updatedAt: Date;
};

export type BotRun = {
  id: string;
  botId: string;
  mode: BotMode;
  status: BotRunStatus;
  configurationSnapshot: unknown;
  strategySnapshot: unknown;
  backtestFrom: Date | null;
  backtestTo: Date | null;
  startedAt: Date;
  endedAt: Date | null;
  errorMessage: string | null;
};

export type Position = {
  id: string;
  botRunId: string;
  status: PositionStatus;
  entryCost: string;
  entryQuantity: string;
  remainingQuantity: string;
  averageEntryPrice: string;
  averageExitPrice: string | null;
  fees: string;
  realizedPnl: string;
  openedAt: Date | null;
  closedAt: Date | null;
};

export type BotOrder = {
  id: string;
  botRunId: string;
  positionId: string | null;
  idempotencyKey: string;
  exchangeOrderId: string | null;
  side: "BUY" | "SELL";
  status: BotOrderStatus;
  requestedQuoteAmount: string | null;
  requestedQuantity: string | null;
  executedQuantity: string;
  submittedAt: Date | null;
};

export type Fill = {
  id: string;
  botOrderId: string;
  exchangeTradeId: string | null;
  quantity: string;
  price: string;
  commission: string;
  commissionAsset: string | null;
  filledAt: Date;
};

export type BotLedgerEntry = {
  id: string;
  botRunId: string;
  type: LedgerEntryType;
  amount: string;
  balanceAfter: string;
  referenceType: string | null;
  referenceId: string | null;
  description: string;
  occurredAt: Date;
};

export type StrategyDecision = {
  id: string;
  botRunId: string;
  candleId: string;
  action: BotAction;
  reasonCode: string;
  explanation: string;
  inputs: unknown;
  output: unknown;
  evaluatedAt: Date;
};

export type BotEvent = {
  id: string;
  botRunId: string;
  sequenceNumber: bigint;
  eventType: string;
  candleOpenTime: Date | null;
  payload: unknown;
  occurredAt: Date;
};

export type IndicatorSnapshot = {
  id: string;
  botRunId: string;
  candleId: string;
  values: unknown;
  calculatedAt: Date;
};

export type PortfolioSnapshot = {
  id: string;
  botRunId: string;
  sequenceNumber: bigint;
  availableBudget: string;
  reservedBudget: string;
  investedCost: string;
  marketValue: string;
  realizedPnl: string;
  unrealizedPnl: string;
  totalEquity: string;
  capturedAt: Date;
};
