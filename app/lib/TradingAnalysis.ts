import Big from "big.js";
import { CandleChartResult } from "binance-api-node";

export interface DCandle extends CandleChartResult {
  rsi6: number | null;
  ema7: number | null;
  ema25: number | null;
  ema100: number | null;
  ema7Diff: number | null;
  ema25Diff: number | null;
  ema100Diff: number | null;
  ema7DiffPct: number | null;
  ema25DiffPct: number | null;
  ema100DiffPct: number | null;
  // openTime: number;
  // open: string;
  // high: string;
  // low: string;
  // close: string;
  // volume: string;
  // closeTime: number;
  // quoteVolume: string;
  // trades: number;
  // baseAssetVolume: string;
  // quoteAssetVolume: string;
}

export class TradingAnalysis {
  private candles: DCandle[];
  private currentPrice: number;

  constructor(candles: DCandle[], currentPrice: number) {
    this.candles = [...candles].sort((a, b) => a.openTime - b.openTime);
    this.currentPrice = currentPrice;
  }

  extend(): DCandle[] {
    for (let i = 0; i < this.candles.length; i++) {
      //const currDcandle: DCandle = this.candles[i];
      this.candles[i].rsi6 = this.getRsi(6, -i);

      const periods = [7, 25, 100];
      for (const period of periods) {
        const ema = this.getEma(period, -i);
        (this.candles[i] as any)[`ema${period}`] = ema.ema;
        (this.candles[i] as any)[`ema${period}Diff`] = ema.emaDiff;
        (this.candles[i] as any)[`ema${period}DiffPct`] = ema.emaDiffPct;

        //(this.candles[i] as any)[`ema${period}`] = this.getEma(period, i);
        //this.candles[i].ema7Diff = this.getEmaDiff(this.currentPrice, 7, i);
      }

      // this.candles[i].ema7 = this.getEma(7, i);
      // this.candles[i].ema25 = this.getEma(25, i);
      // this.candles[i].ema100 = this.getEma(100, i);
      // this.candles[i].ema7Diff = this.getEmaDiff(this.currentPrice, 7, i);
      // this.candles[i].ema25Diff = this.getEmaDiff(this.currentPrice, 25, i);
      // this.candles[i].ema100Diff = this.getEmaDiff(this.currentPrice, 100, i);
      // this.candles[i].ema7 = this.getEmaDiffPct(this.currentPrice, 7, i);
      // this.candles[i].ema25 = this.getEmaDiffPct(this.currentPrice, 7, i);
      // this.candles[i].ema100 = this.getEmaDiffPct(this.currentPrice, 7, i);
    }

    return this.candles;
  }

  getRsi(period: number, index: number = 0): number | null {
    if (index > 0) {
      console.error("index must be 0 or negative integer");
      return null;
    }
    if (this.candles.length < period + 1 + index) {
      console.error(
        `Not enough data to calculate RSI, required period: ${period}, index: ${index}, candles: ${this.candles.length}!`
      );
      return null;
    }

    let rsiCandles = [];
    if (index === 0) {
      rsiCandles = this.candles.slice(-period - 1);
    } else {
      rsiCandles = this.candles.slice(-period - 1 + index, index);
    }

    let gains: Big[] = [];
    let losses: Big[] = [];

    for (let i = 1; i < rsiCandles.length; i++) {
      const diff = new Big(rsiCandles[i].close).minus(rsiCandles[i - 1].close);
      gains.push(diff.gt(0) ? diff : new Big(0));
      losses.push(diff.lt(0) ? diff.abs() : new Big(0));
    }

    // Compute initial SMA of gains and losses
    let avgGain = gains
      .slice(0, period)
      .reduce((acc, val) => acc.plus(val), new Big(0))
      .div(period);
    let avgLoss = losses
      .slice(0, period)
      .reduce((acc, val) => acc.plus(val), new Big(0))
      .div(period);

    // Apply Wilder's smoothing method
    for (let i = period; i < gains.length; i++) {
      avgGain = avgGain
        .times(period - 1)
        .plus(gains[i])
        .div(period);
      avgLoss = avgLoss
        .times(period - 1)
        .plus(losses[i])
        .div(period);
    }

    if (avgLoss.eq(0)) return 100; // Prevent division by zero

    const rs = avgGain.div(avgLoss);
    return Number(new Big(100).minus(new Big(100).div(rs.plus(1))));
  }

  getEma(
    //currentPrice: number,
    period: number,
    index: number = 0
  ): {
    ema: number | null;
    emaDiff: number | null;
    emaDiffPct: number | null;
  } {
    if (index > 0) {
      console.error("index must be 0 or negative integer");
      return { ema: null, emaDiff: null, emaDiffPct: null };
    }
    if (this.candles.length < period + 1 + index) {
      console.error(
        `Not enough data to calculate RSI, required period: ${period}, index: ${index}, candles: ${this.candles.length}!`
      );
      return { ema: null, emaDiff: null, emaDiffPct: null };
    }

    let emaCandles = this.candles;
    if (index !== 0) {
      emaCandles = this.candles.slice(index);
    }

    if (emaCandles.length < period)
      return { ema: null, emaDiff: null, emaDiffPct: null };

    const k = new Big(2).div(new Big(period + 1));
    let emaBig = new Big(this.candles[0].close);

    for (let i = 1; i < emaCandles.length; i++) {
      emaBig = new Big(this.candles[i].close)
        .times(k)
        .plus(emaBig.times(new Big(1).minus(k)));
    }

    const ema = Number(emaBig);
    const emaDiff = Number(new Big(this.currentPrice).minus(ema));
    const emaDiffPct = Number(
      new Big(this.currentPrice).minus(ema).div(ema).times(100)
    );

    return { ema, emaDiff, emaDiffPct };
  }

  getMinMax(period: number): {
    min: number;
    max: number;
    currentPriceMinDiffPct: number;
    currentPriceMaxDiffPct: number;
  } {
    const candles = this.candles.slice(-period);

    const res = {
      min: 999999999999,
      max: 0,
      currentPriceMinDiffPct: 0,
      currentPriceMaxDiffPct: 0,
    };

    for (const candle of candles) {
      if (parseFloat(candle.high) > res.max) {
        res.max = parseFloat(candle.high);
        res.currentPriceMaxDiffPct = 100 * (this.currentPrice / res.max - 1);
      }
      if (parseFloat(candle.low) < res.min) {
        res.min = parseFloat(candle.low);
        res.currentPriceMinDiffPct = 100 * (this.currentPrice / res.min - 1);
      }
    }

    return res;
  }

  // getEmaDiff(currentPrice: number, period: number): number | null {
  //   const ema = this.getEma(period);
  //   if (ema === null) return null;
  //   return Number(new Big(currentPrice).minus(ema));
  // }

  // getEmaDiffPct(currentPrice: number, period: number): number | null {
  //   const ema = this.getEma(period);
  //   if (ema === null) return null;
  //   return Number(new Big(currentPrice).minus(ema).div(ema).times(100));
  // }
}
