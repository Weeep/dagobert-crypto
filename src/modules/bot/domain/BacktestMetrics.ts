import Big from "big.js";
import type { Candle } from "@/src/modules/market";
import type { BacktestExecutionConfig } from "./BacktestPortfolio";
import { calculateBacktestMarketPrice } from "./BacktestPortfolio";
import type { HistoricalBacktestResult } from "./HistoricalBacktestRunner";

export type BacktestMetrics = {
  initialCapital: string;
  endingCash: string;
  endingEquity: string;
  netProfit: string;
  returnPct: string;
  maximumDrawdownPct: string;
  winRatePct: string;
  profitFactor: string | null;
  totalFees: string;
  tradeCount: number;
  openPositionCount: number;
  averageHoldingTimeMs: number | null;
  buyAndHoldReturnPct: string;
  buyAndHoldEndingEquity: string;
  strategyVsBuyAndHoldPct: string;
};

const value = (number: Big) => number.toFixed(8).replace(/\.?0+$/, "") || "0";

export function calculateBacktestMetrics(result: HistoricalBacktestResult, evaluatedCandles: readonly Candle[],
  execution: BacktestExecutionConfig): BacktestMetrics {
  if (evaluatedCandles.length === 0) throw new Error("evaluated candles are required for metrics");
  const initial = new Big(result.portfolio.initialCash);
  const finalCandle = evaluatedCandles.at(-1)!;
  const finalSnapshot = result.snapshots.at(-1)?.portfolio;
  if (!finalSnapshot) throw new Error("final portfolio snapshot is required for metrics");
  const endingEquity = new Big(finalSnapshot.totalEquity);
  const netProfit = endingEquity.minus(initial);
  const maximumDrawdown = new Big(result.maximumDrawdownPct);
  const closed = result.portfolio.closedPositions;
  const wins = closed.filter((position) => new Big(position.realizedPnl).gt(0));
  const grossProfit = wins.reduce((total, position) => total.plus(position.realizedPnl), new Big(0));
  const grossLoss = closed.filter((position) => new Big(position.realizedPnl).lt(0))
    .reduce((total, position) => total.plus(new Big(position.realizedPnl).abs()), new Big(0));
  const holdingTotal = closed.reduce((total, position) =>
    total + (new Date(position.closedAt).getTime() - new Date(position.openedAt).getTime()), 0);

  const firstCandle = evaluatedCandles[0];
  const buyPrice = new Big(calculateBacktestMarketPrice("BUY", firstCandle.open, execution.slippageRate));
  const feeRate = new Big(execution.feeRate);
  const buyNotional = initial.div(new Big(1).plus(feeRate));
  const buyQuantity = buyNotional.div(buyPrice);
  const buyAndHoldEquity = buyQuantity.times(finalCandle.close);
  const buyAndHoldReturn = buyAndHoldEquity.minus(initial).div(initial).times(100);
  const strategyReturn = netProfit.div(initial).times(100);
  return {
    initialCapital: value(initial), endingCash: value(new Big(result.portfolio.cash)),
    endingEquity: value(endingEquity), netProfit: value(netProfit), returnPct: value(strategyReturn),
    maximumDrawdownPct: value(maximumDrawdown),
    winRatePct: closed.length ? value(new Big(wins.length).div(closed.length).times(100)) : "0",
    profitFactor: grossLoss.eq(0) ? null : value(grossProfit.div(grossLoss)),
    totalFees: value(new Big(result.portfolio.totalFees)), tradeCount: closed.length,
    openPositionCount: result.portfolio.openPositions.length,
    averageHoldingTimeMs: closed.length ? Math.round(holdingTotal / closed.length) : null,
    buyAndHoldReturnPct: value(buyAndHoldReturn), buyAndHoldEndingEquity: value(buyAndHoldEquity),
    strategyVsBuyAndHoldPct: value(strategyReturn.minus(buyAndHoldReturn)),
  };
}
