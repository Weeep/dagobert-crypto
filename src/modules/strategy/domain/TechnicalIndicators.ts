import Big from "big.js";

export type IndicatorPrice = {
  close: string;
  /** When present, open candles are rejected instead of being silently ignored. */
  isClosed?: boolean;
};

export type HistoricalIndicatorCache = {
  ema(period: number, index: number): number | null;
  rsi(period: number, index: number): number | null;
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

/**
 * Lazily calculates complete causal indicator series once per distinct period.
 * Looking up a value for a candle is O(1), while values retain the exact same
 * SMA seed and smoothing rules as calculateEma/calculateRsi on that prefix.
 */
export function createHistoricalIndicatorCache(
  prices: readonly IndicatorPrice[],
): HistoricalIndicatorCache {
  const closes = closedValues(prices);
  const emaSeries = new Map<number, Array<number | null>>();
  const rsiSeries = new Map<number, Array<number | null>>();
  const index = (value: number) => {
    if (!Number.isSafeInteger(value) || value < 0 || value >= closes.length)
      throw new RangeError("indicator index is outside the historical series");
    return value;
  };

  const buildEma = (period: number) => {
    validatePeriod(period);
    const values = Array<number | null>(closes.length).fill(null);
    if (closes.length >= period) {
      let ema = closes.slice(0, period).reduce((sum, value) => sum.plus(value), new Big(0)).div(period);
      values[period - 1] = Number(ema);
      const alpha = new Big(2).div(period + 1);
      const inverseAlpha = new Big(1).minus(alpha);
      for (let current = period; current < closes.length; current += 1) {
        ema = closes[current].times(alpha).plus(ema.times(inverseAlpha));
        values[current] = Number(ema);
      }
    }
    emaSeries.set(period, values);
    return values;
  };

  const buildRsi = (period: number) => {
    validatePeriod(period);
    const values = Array<number | null>(closes.length).fill(null);
    if (closes.length >= period + 1) {
      let gainSum = new Big(0);
      let lossSum = new Big(0);
      for (let current = 1; current <= period; current += 1) {
        const change = closes[current].minus(closes[current - 1]);
        if (change.gt(0)) gainSum = gainSum.plus(change);
        else if (change.lt(0)) lossSum = lossSum.plus(change.abs());
      }
      let avgGain = gainSum.div(period);
      let avgLoss = lossSum.div(period);
      values[period] = rsiValue(avgGain, avgLoss);
      for (let current = period + 1; current < closes.length; current += 1) {
        const change = closes[current].minus(closes[current - 1]);
        const gain = change.gt(0) ? change : new Big(0);
        const loss = change.lt(0) ? change.abs() : new Big(0);
        avgGain = avgGain.times(period - 1).plus(gain).div(period);
        avgLoss = avgLoss.times(period - 1).plus(loss).div(period);
        values[current] = rsiValue(avgGain, avgLoss);
      }
    }
    rsiSeries.set(period, values);
    return values;
  };

  return {
    ema: (period, at) => (emaSeries.get(period) ?? buildEma(period))[index(at)],
    rsi: (period, at) => (rsiSeries.get(period) ?? buildRsi(period))[index(at)],
  };
}
