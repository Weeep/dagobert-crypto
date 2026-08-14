import Big from "big.js";
import { CandleChartResult } from "binance-api-node";
import { calculateEma, calculateRsi } from "@/src/modules/strategy/domain/TechnicalIndicators";

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
      const offsetFromLatest = i - (this.candles.length - 1);
      this.candles[i].rsi6 = this.getRsi(6, offsetFromLatest);

      const periods = [7, 25, 100];
      for (const period of periods) {
        const emaValue = calculateEma(this.candles.slice(0, i + 1), period);
        const ema = this.emaResult(emaValue, Number(this.candles[i].close));
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
    const candles = this.candlesThroughOffset(index);
    return candles ? calculateRsi(candles, period) : null;
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
    const candles = this.candlesThroughOffset(index);
    if (!candles) return this.emaResult(null, this.currentPrice);
    return this.emaResult(calculateEma(candles, period), this.currentPrice);
  }

  private candlesThroughOffset(index: number): DCandle[] | null {
    if (!Number.isInteger(index) || index > 0) return null;
    const end = index === 0 ? this.candles.length : this.candles.length + index;
    return end > 0 ? this.candles.slice(0, end) : null;
  }

  private emaResult(ema: number | null, referencePrice: number) {
    if (ema === null) return { ema: null, emaDiff: null, emaDiffPct: null };
    const emaBig = new Big(ema);
    const difference = new Big(referencePrice).minus(emaBig);
    return {
      ema,
      emaDiff: Number(difference),
      emaDiffPct: emaBig.eq(0) ? null : Number(difference.div(emaBig).times(100)),
    };
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

  isBull(
    ema7DiffPct: number,
    ema25DiffPct: number,
    ema100DiffPct: number
  ): boolean {
    return (
      ema7DiffPct > 0 &&
      ema7DiffPct < ema25DiffPct &&
      ema25DiffPct < ema100DiffPct
    );
  }

  isBear(
    ema7DiffPct: number,
    ema25DiffPct: number,
    ema100DiffPct: number
  ): boolean {
    return (
      ema7DiffPct < 0 &&
      //ema25DiffPct < 0 &&
      //ema100DiffPct < 0 &&
      ema7DiffPct > ema25DiffPct &&
      ema25DiffPct > ema100DiffPct
    );
  }

  calculateRsi(period: number): number | null {
    return calculateRsi(this.candles, period);
  }

  SMA(values: number[], length: number): (number | null)[] {
    let result = [];
    for (let i = 0; i < values.length; i++) {
      if (i + 1 < length) {
        result.push(null); // nincs elég adat
      } else {
        let sum = 0;
        for (let j = 0; j < length; j++) {
          sum += values[i - j];
        }
        result.push(sum / length);
      }
    }
    return result;
  }

  /////
}
