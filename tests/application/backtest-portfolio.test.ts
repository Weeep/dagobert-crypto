import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  BacktestPortfolioInputError,
  calculateBacktestMarketPrice,
  closeAllBacktestPositions,
  closeSelectedBacktestPositions,
  createBacktestPortfolio,
  fillBacktestEntry,
  releaseBacktestEntry,
  reserveBacktestEntry,
  snapshotBacktestPortfolio,
  validateBacktestExecutionConfig,
  type BacktestExecutionConfig,
  type BacktestPortfolio,
} from "@/src/modules/bot";

const configuration: BacktestExecutionConfig = {
  assignedBudget: "55",
  amountPerPosition: "10",
  feeRate: "0.001",
  slippageRate: "0.005",
};
const hour = (value: number) => new Date(`2026-01-01T${String(value).padStart(2, "0")}:00:00.000Z`);

const reserveAndFill = (portfolio: BacktestPortfolio, index: number, nextOpen = "100") => {
  const reserved = reserveBacktestEntry(portfolio, configuration, `reservation-${index}`);
  assert.equal(reserved.ok, true);
  if (!reserved.ok) throw new Error("entry reservation failed");
  return fillBacktestEntry(reserved.portfolio, configuration, {
    reservationId: reserved.reservation.id,
    positionId: `position-${index}`,
    nextOpen,
    filledAt: hour(index),
  });
};

describe("pure backtest portfolio", () => {
  test("validates configuration and creates a decimal cash wallet", () => {
    assert.deepEqual(createBacktestPortfolio(configuration), {
      initialCash: "55", cash: "55", reservations: [], openPositions: [], closedPositions: [],
      realizedPnl: "0", totalFees: "0",
    });
    assert.throws(() => validateBacktestExecutionConfig({ ...configuration, assignedBudget: "nope" }),
      BacktestPortfolioInputError);
    assert.throws(() => validateBacktestExecutionConfig({ ...configuration, amountPerPosition: "0" }),
      /amountPerPosition must be positive/);
    assert.throws(() => validateBacktestExecutionConfig({ ...configuration, feeRate: "-0.1" }),
      /feeRate cannot be negative/);
    assert.throws(() => validateBacktestExecutionConfig({ ...configuration, slippageRate: "1" }),
      /slippageRate must be less than 1/);
    assert.throws(() => validateBacktestExecutionConfig({ ...configuration, amountPerPosition: "56" }),
      /cannot exceed assignedBudget/);
  });

  test("applies adverse side-specific slippage without constraining the simulated price to OHLC", () => {
    assert.equal(calculateBacktestMarketPrice("BUY", "100", "0.005"), "100.5");
    assert.equal(calculateBacktestMarketPrice("SELL", "100", "0.005"), "99.5");
    assert.throws(() => calculateBacktestMarketPrice("BUY", "0", "0"), /nextOpen must be positive/);
  });

  test("reserves total entry outflow and enforces the 55/10 five-position limit", () => {
    let portfolio = createBacktestPortfolio(configuration);
    for (let index = 0; index < 5; index += 1) {
      const result = reserveAndFill(portfolio, index);
      portfolio = result.portfolio;
      assert.equal(result.fill.cashChange, "-10");
      assert.equal(result.position.entryPrice, "100.5");
    }
    assert.equal(portfolio.cash, "5");
    assert.equal(portfolio.openPositions.length, 5);
    const sixth = reserveBacktestEntry(portfolio, configuration, "reservation-6");
    assert.deepEqual(sixth, { ok: false, portfolio, reason: "INSUFFICIENT_AVAILABLE_CASH" });
    assert.equal(snapshotBacktestPortfolio(portfolio, "100").availableCash, "5");
  });

  test("counts pending reservations atomically against available cash and supports release", () => {
    let portfolio = createBacktestPortfolio({ ...configuration, assignedBudget: "20" });
    const first = reserveBacktestEntry(portfolio, { ...configuration, assignedBudget: "20" }, "same");
    assert.equal(first.ok, true); if (!first.ok) return;
    portfolio = first.portfolio;
    const duplicate = reserveBacktestEntry(portfolio, { ...configuration, assignedBudget: "20" }, "same");
    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) assert.equal(duplicate.reason, "DUPLICATE_RESERVATION_ID");
    const second = reserveBacktestEntry(portfolio, { ...configuration, assignedBudget: "20" }, "second");
    assert.equal(second.ok, true); if (!second.ok) return;
    const unavailable = reserveBacktestEntry(second.portfolio,
      { ...configuration, assignedBudget: "20" }, "third");
    assert.equal(unavailable.ok, false);
    if (!unavailable.ok) assert.equal(unavailable.reason, "INSUFFICIENT_AVAILABLE_CASH");
    assert.equal(snapshotBacktestPortfolio(second.portfolio, "100").availableCash, "0");
    assert.equal(snapshotBacktestPortfolio(releaseBacktestEntry(second.portfolio, "same"), "100").availableCash, "10");
    assert.throws(() => releaseBacktestEntry(portfolio, "missing"), /reservation was not found/);
  });

  test("derives quantity so actual notional and fee fit inside amountPerPosition", () => {
    const portfolio = createBacktestPortfolio(configuration);
    const filled = reserveAndFill(portfolio, 1, "250.25");
    const notional = Number(filled.position.entryNotional);
    const fee = Number(filled.position.entryFee);
    assert.ok(Math.abs(notional * 0.001 - fee) < 1e-12);
    assert.ok(notional + fee <= 10);
    assert.equal(filled.portfolio.cash, "45");
    assert.equal(filled.portfolio.reservations.length, 0);
    assert.equal(filled.portfolio.totalFees, filled.position.entryFee);
    assert.equal(filled.fill.notional, filled.position.entryNotional);
  });

  test("closes every independent lot in full with separate sell fills", () => {
    let portfolio = reserveAndFill(createBacktestPortfolio(configuration), 1, "100").portfolio;
    portfolio = reserveAndFill(portfolio, 2, "80").portfolio;
    const closed = closeAllBacktestPositions(portfolio, configuration, {
      nextOpen: "120", filledAt: hour(12),
    });
    assert.equal(closed.positions.length, 2);
    assert.equal(closed.fills.length, 2);
    assert.deepEqual(closed.fills.map((fill) => fill.positionId), ["position-1", "position-2"]);
    assert.ok(closed.fills.every((fill) => fill.side === "SELL" && fill.price === "119.4"));
    assert.equal(closed.portfolio.openPositions.length, 0);
    assert.equal(closed.portfolio.closedPositions.length, 2);
    assert.ok(closed.positions.every((position) => position.closedAt === hour(12).toISOString()));
    assert.ok(Number(closed.positions[0].realizedPnl) > 0);
    assert.ok(Number(closed.positions[1].realizedPnl) > 0);
    assert.ok(Number(closed.portfolio.realizedPnl) > 0);
    assert.ok(Number(closed.portfolio.cash) > 55);
  });

  test("closes only selected lots and leaves the other lots open", () => {
    let portfolio = reserveAndFill(createBacktestPortfolio(configuration), 1, "100").portfolio;
    portfolio = reserveAndFill(portfolio, 2, "80").portfolio;
    const closed = closeSelectedBacktestPositions(portfolio, configuration, {
      positionIds: ["position-2"], nextOpen: "120", filledAt: hour(12),
    });
    assert.deepEqual(closed.positions.map((position) => position.id), ["position-2"]);
    assert.deepEqual(closed.portfolio.openPositions.map((position) => position.id), ["position-1"]);
    assert.deepEqual(closed.portfolio.closedPositions.map((position) => position.id), ["position-2"]);
    assert.throws(() => closeSelectedBacktestPositions(portfolio, configuration, {
      positionIds: ["missing"], nextOpen: "120", filledAt: hour(12),
    }), /open position not found/);
  });

  test("keeps entry fees in losing-lot PnL and marks open positions without force closing", () => {
    const opened = reserveAndFill(createBacktestPortfolio(configuration), 1, "100").portfolio;
    const marked = snapshotBacktestPortfolio(opened, "90");
    assert.equal(marked.openPositionCount, 1);
    assert.equal(marked.cash, "45");
    assert.equal(marked.reservedCash, "0");
    assert.equal(marked.investedCost, "10");
    assert.ok(Number(marked.unrealizedPnl) < 0);
    assert.equal(opened.closedPositions.length, 0);

    const closed = closeAllBacktestPositions(opened, configuration, { nextOpen: "90", filledAt: hour(2) });
    assert.ok(Number(closed.positions[0].realizedPnl) < 0);
    assert.equal(closed.portfolio.realizedPnl, closed.positions[0].realizedPnl);
    assert.equal(snapshotBacktestPortfolio(closed.portfolio, "90").unrealizedPnl, "0");
  });

  test("does not mutate an earlier portfolio snapshot", () => {
    const initial = createBacktestPortfolio(configuration);
    const reserved = reserveBacktestEntry(initial, configuration, "reservation");
    assert.equal(reserved.ok, true); if (!reserved.ok) return;
    const filled = fillBacktestEntry(reserved.portfolio, configuration, {
      reservationId: "reservation", positionId: "position", nextOpen: "100", filledAt: hour(1),
    });
    closeAllBacktestPositions(filled.portfolio, configuration, { nextOpen: "110", filledAt: hour(2) });
    assert.deepEqual(initial, createBacktestPortfolio(configuration));
    assert.equal(reserved.portfolio.reservations.length, 1);
    assert.equal(reserved.portfolio.openPositions.length, 0);
    assert.equal(filled.portfolio.openPositions.length, 1);
  });
});
