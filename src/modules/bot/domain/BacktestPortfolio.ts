import Big from "big.js";

export type BacktestExecutionConfig = {
  assignedBudget: string;
  amountPerPosition: string;
  feeRate: string;
  slippageRate: string;
};

export type BacktestEntryReservation = {
  id: string;
  amount: string;
};

export type BacktestOpenPosition = {
  id: string;
  entryPrice: string;
  quantity: string;
  entryNotional: string;
  entryFee: string;
  openedAt: string;
};

export type BacktestClosedPosition = BacktestOpenPosition & {
  exitPrice: string;
  exitNotional: string;
  exitFee: string;
  realizedPnl: string;
  closedAt: string;
};

export type BacktestPortfolio = {
  initialCash: string;
  cash: string;
  reservations: BacktestEntryReservation[];
  openPositions: BacktestOpenPosition[];
  closedPositions: BacktestClosedPosition[];
  realizedPnl: string;
  totalFees: string;
};

export type BacktestFill = {
  side: "BUY" | "SELL";
  positionId: string;
  price: string;
  quantity: string;
  notional: string;
  fee: string;
  cashChange: string;
  filledAt: string;
};

export type BacktestPortfolioSnapshot = {
  cash: string;
  reservedCash: string;
  availableCash: string;
  investedCost: string;
  marketValue: string;
  realizedPnl: string;
  unrealizedPnl: string;
  totalEquity: string;
  totalFees: string;
  openPositionCount: number;
};

export type BacktestRiskRejection =
  | "INSUFFICIENT_AVAILABLE_CASH"
  | "DUPLICATE_RESERVATION_ID";

export class BacktestPortfolioInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BacktestPortfolioInputError";
    Object.setPrototypeOf(this, BacktestPortfolioInputError.prototype);
  }
}

const decimal = (value: string, field: string) => {
  try {
    return new Big(value);
  } catch {
    throw new BacktestPortfolioInputError(`${field} must be a decimal`);
  }
};

const positive = (value: string, field: string) => {
  const parsed = decimal(value, field);
  if (parsed.lte(0)) throw new BacktestPortfolioInputError(`${field} must be positive`);
  return parsed;
};

const nonNegative = (value: string, field: string) => {
  const parsed = decimal(value, field);
  if (parsed.lt(0)) throw new BacktestPortfolioInputError(`${field} cannot be negative`);
  return parsed;
};

const timestamp = (value: Date, field: string) => {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime()))
    throw new BacktestPortfolioInputError(`${field} must be a valid date`);
  return value.toISOString();
};

const identifier = (value: string, field: string) => {
  if (typeof value !== "string" || value.trim() === "")
    throw new BacktestPortfolioInputError(`${field} cannot be empty`);
  return value;
};

const sum = (values: string[]) => values.reduce((total, value) => total.plus(value), new Big(0));
const clone = (portfolio: BacktestPortfolio): BacktestPortfolio => ({
  ...portfolio,
  reservations: portfolio.reservations.map((reservation) => ({ ...reservation })),
  openPositions: portfolio.openPositions.map((position) => ({ ...position })),
  closedPositions: portfolio.closedPositions.map((position) => ({ ...position })),
});

export function validateBacktestExecutionConfig(config: BacktestExecutionConfig) {
  const assignedBudget = positive(config.assignedBudget, "assignedBudget");
  const amountPerPosition = positive(config.amountPerPosition, "amountPerPosition");
  const feeRate = nonNegative(config.feeRate, "feeRate");
  const slippageRate = nonNegative(config.slippageRate, "slippageRate");
  if (slippageRate.gte(1))
    throw new BacktestPortfolioInputError("slippageRate must be less than 1");
  if (amountPerPosition.gt(assignedBudget))
    throw new BacktestPortfolioInputError("amountPerPosition cannot exceed assignedBudget");
  return { assignedBudget, amountPerPosition, feeRate, slippageRate };
}

export function createBacktestPortfolio(config: BacktestExecutionConfig): BacktestPortfolio {
  const { assignedBudget } = validateBacktestExecutionConfig(config);
  return {
    initialCash: assignedBudget.toString(),
    cash: assignedBudget.toString(),
    reservations: [],
    openPositions: [],
    closedPositions: [],
    realizedPnl: "0",
    totalFees: "0",
  };
}

export function calculateBacktestMarketPrice(
  side: "BUY" | "SELL",
  nextOpen: string,
  slippageRate: string,
) {
  const open = positive(nextOpen, "nextOpen");
  const slippage = nonNegative(slippageRate, "slippageRate");
  if (slippage.gte(1)) throw new BacktestPortfolioInputError("slippageRate must be less than 1");
  return open.times(side === "BUY" ? new Big(1).plus(slippage) : new Big(1).minus(slippage)).toString();
}

export function reserveBacktestEntry(
  portfolio: BacktestPortfolio,
  config: BacktestExecutionConfig,
  reservationId: string,
): { ok: true; portfolio: BacktestPortfolio; reservation: BacktestEntryReservation } |
   { ok: false; portfolio: BacktestPortfolio; reason: BacktestRiskRejection } {
  const { amountPerPosition } = validateBacktestExecutionConfig(config);
  identifier(reservationId, "reservationId");
  if (portfolio.reservations.some((reservation) => reservation.id === reservationId))
    return { ok: false, portfolio, reason: "DUPLICATE_RESERVATION_ID" };
  const available = decimal(portfolio.cash, "portfolio.cash")
    .minus(sum(portfolio.reservations.map((reservation) => reservation.amount)));
  if (available.lt(amountPerPosition))
    return { ok: false, portfolio, reason: "INSUFFICIENT_AVAILABLE_CASH" };
  const reservation = { id: reservationId, amount: amountPerPosition.toString() };
  const next = clone(portfolio);
  next.reservations.push(reservation);
  return { ok: true, portfolio: next, reservation };
}

export function releaseBacktestEntry(portfolio: BacktestPortfolio, reservationId: string) {
  identifier(reservationId, "reservationId");
  if (!portfolio.reservations.some((reservation) => reservation.id === reservationId))
    throw new BacktestPortfolioInputError("entry reservation was not found");
  const next = clone(portfolio);
  next.reservations = next.reservations.filter((reservation) => reservation.id !== reservationId);
  return next;
}

export function fillBacktestEntry(
  portfolio: BacktestPortfolio,
  config: BacktestExecutionConfig,
  input: { reservationId: string; positionId: string; nextOpen: string; filledAt: Date },
): { portfolio: BacktestPortfolio; position: BacktestOpenPosition; fill: BacktestFill } {
  const { feeRate, slippageRate } = validateBacktestExecutionConfig(config);
  const reservation = portfolio.reservations.find((item) => item.id === input.reservationId);
  if (!reservation) throw new BacktestPortfolioInputError("entry reservation was not found");
  identifier(input.positionId, "positionId");
  if (portfolio.openPositions.some((position) => position.id === input.positionId) ||
      portfolio.closedPositions.some((position) => position.id === input.positionId))
    throw new BacktestPortfolioInputError("positionId must be unique");
  const price = new Big(calculateBacktestMarketPrice("BUY", input.nextOpen, slippageRate.toString()));
  const maximumOutflow = decimal(reservation.amount, "reservation.amount");
  const notional = maximumOutflow.div(new Big(1).plus(feeRate));
  // Keep the configured cash cap exact after decimal division. Algebraically this
  // remainder is the configured rate applied to the pre-fee fill notional.
  const fee = maximumOutflow.minus(notional);
  const cashOutflow = maximumOutflow;
  const currentCash = decimal(portfolio.cash, "portfolio.cash");
  if (cashOutflow.gt(currentCash))
    throw new BacktestPortfolioInputError("entry fill exceeds portfolio cash");
  const filledAt = timestamp(input.filledAt, "filledAt");
  const position: BacktestOpenPosition = {
    id: input.positionId,
    entryPrice: price.toString(),
    quantity: notional.div(price).toString(),
    entryNotional: notional.toString(),
    entryFee: fee.toString(),
    openedAt: filledAt,
  };
  const next = clone(portfolio);
  next.cash = currentCash.minus(cashOutflow).toString();
  next.totalFees = decimal(next.totalFees, "portfolio.totalFees").plus(fee).toString();
  next.reservations = next.reservations.filter((item) => item.id !== input.reservationId);
  next.openPositions.push({ ...position });
  return {
    portfolio: next,
    position,
    fill: { side: "BUY", positionId: position.id, price: position.entryPrice,
      quantity: position.quantity, notional: position.entryNotional, fee: position.entryFee,
      cashChange: cashOutflow.times(-1).toString(), filledAt },
  };
}

export function closeAllBacktestPositions(
  portfolio: BacktestPortfolio,
  config: BacktestExecutionConfig,
  input: { nextOpen: string; filledAt: Date },
): { portfolio: BacktestPortfolio; positions: BacktestClosedPosition[]; fills: BacktestFill[] } {
  const { feeRate, slippageRate } = validateBacktestExecutionConfig(config);
  const price = new Big(calculateBacktestMarketPrice("SELL", input.nextOpen, slippageRate.toString()));
  const filledAt = timestamp(input.filledAt, "filledAt");
  const positions = portfolio.openPositions.map((open): BacktestClosedPosition => {
    const exitNotional = decimal(open.quantity, "position.quantity").times(price);
    const exitFee = exitNotional.times(feeRate);
    const entryOutflow = decimal(open.entryNotional, "position.entryNotional").plus(open.entryFee);
    return { ...open, exitPrice: price.toString(), exitNotional: exitNotional.toString(),
      exitFee: exitFee.toString(), realizedPnl: exitNotional.minus(exitFee).minus(entryOutflow).toString(),
      closedAt: filledAt };
  });
  const fills = positions.map((position): BacktestFill => {
    const proceeds = decimal(position.exitNotional, "position.exitNotional").minus(position.exitFee);
    return { side: "SELL", positionId: position.id, price: position.exitPrice,
      quantity: position.quantity, notional: position.exitNotional, fee: position.exitFee,
      cashChange: proceeds.toString(), filledAt };
  });
  const next = clone(portfolio);
  next.cash = decimal(next.cash, "portfolio.cash").plus(sum(fills.map((fill) => fill.cashChange))).toString();
  next.realizedPnl = decimal(next.realizedPnl, "portfolio.realizedPnl")
    .plus(sum(positions.map((position) => position.realizedPnl))).toString();
  next.totalFees = decimal(next.totalFees, "portfolio.totalFees")
    .plus(sum(positions.map((position) => position.exitFee))).toString();
  next.openPositions = [];
  next.closedPositions.push(...positions.map((position) => ({ ...position })));
  return { portfolio: next, positions: positions.map((position) => ({ ...position })), fills };
}

export function snapshotBacktestPortfolio(
  portfolio: BacktestPortfolio,
  marketPrice: string,
): BacktestPortfolioSnapshot {
  const price = positive(marketPrice, "marketPrice");
  const cash = decimal(portfolio.cash, "portfolio.cash");
  const reservedCash = sum(portfolio.reservations.map((reservation) => reservation.amount));
  const investedCost = sum(portfolio.openPositions.map((position) =>
    decimal(position.entryNotional, "position.entryNotional").plus(position.entryFee).toString()));
  const marketValue = sum(portfolio.openPositions.map((position) =>
    decimal(position.quantity, "position.quantity").times(price).toString()));
  const unrealizedPnl = marketValue.minus(investedCost);
  return { cash: cash.toString(), reservedCash: reservedCash.toString(),
    availableCash: cash.minus(reservedCash).toString(), investedCost: investedCost.toString(),
    marketValue: marketValue.toString(), realizedPnl: decimal(portfolio.realizedPnl, "portfolio.realizedPnl").toString(),
    unrealizedPnl: unrealizedPnl.toString(), totalEquity: cash.plus(marketValue).toString(),
    totalFees: decimal(portfolio.totalFees, "portfolio.totalFees").toString(),
    openPositionCount: portfolio.openPositions.length };
}
