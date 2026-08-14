import Big from "big.js";

export type IndicatorPrice = {
  close: string;
  /** When present, open candles are rejected instead of being silently ignored. */
  isClosed?: boolean;
};

function validatePeriod(period: number): void {
  if (!Number.isSafeInteger(period) || period <= 0) {
    throw new RangeError("indicator period must be a positive safe integer");
  }
}

function closedValues(prices: readonly IndicatorPrice[]): Big[] {
  return prices.map((price) => {
    if (price.isClosed === false) throw new Error("indicators require closed candles");
    try {
      return new Big(price.close);
    } catch {
      throw new TypeError("candle close must be a finite decimal string");
    }
  });
}

function rsiValue(avgGain: Big, avgLoss: Big): number {
  if (avgGain.eq(0) && avgLoss.eq(0)) return 50;
  if (avgLoss.eq(0)) return 100;
  if (avgGain.eq(0)) return 0;
  const relativeStrength = avgGain.div(avgLoss);
  return Number(new Big(100).minus(new Big(100).div(relativeStrength.plus(1))));
}

/**
 * Calculates the latest Wilder RSI value. The first averages are the SMA of the
 * first `period` changes; every later change uses Wilder smoothing. At least
 * `period + 1` closed candles are required.
 */
export function calculateRsi(prices: readonly IndicatorPrice[], period = 14): number | null {
  validatePeriod(period);
  const closes = closedValues(prices);
  if (closes.length < period + 1) return null;

  const gains: Big[] = [];
  const losses: Big[] = [];
  for (let index = 1; index < closes.length; index += 1) {
    const change = closes[index].minus(closes[index - 1]);
    gains.push(change.gt(0) ? change : new Big(0));
    losses.push(change.lt(0) ? change.abs() : new Big(0));
  }

  let avgGain = gains.slice(0, period).reduce((sum, value) => sum.plus(value), new Big(0)).div(period);
  let avgLoss = losses.slice(0, period).reduce((sum, value) => sum.plus(value), new Big(0)).div(period);
  for (let index = period; index < gains.length; index += 1) {
    avgGain = avgGain.times(period - 1).plus(gains[index]).div(period);
    avgLoss = avgLoss.times(period - 1).plus(losses[index]).div(period);
  }
  return rsiValue(avgGain, avgLoss);
}

/**
 * Calculates the latest standard EMA using `2 / (period + 1)` as alpha. The
 * first EMA is seeded with the SMA of the first `period` closes.
 */
export function calculateEma(prices: readonly IndicatorPrice[], period: number): number | null {
  validatePeriod(period);
  const closes = closedValues(prices);
  if (closes.length < period) return null;

  let ema = closes.slice(0, period).reduce((sum, value) => sum.plus(value), new Big(0)).div(period);
  const alpha = new Big(2).div(period + 1);
  const inverseAlpha = new Big(1).minus(alpha);
  for (let index = period; index < closes.length; index += 1) {
    ema = closes[index].times(alpha).plus(ema.times(inverseAlpha));
  }
  return Number(ema);
}
