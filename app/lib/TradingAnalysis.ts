import Big from "big.js";

interface Candle {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteVolume: string;
  trades: number;
  baseAssetVolume: string;
  quoteAssetVolume: string;
}

export class TradingAnalysis {
  private candles: Candle[];

  constructor(candles: Candle[]) {
    this.candles = [...candles].sort((a, b) => a.openTime - b.openTime);
  }

  getRsi(period: number): number | null {
    if (this.candles.length < period + 1) return null;

    const rsiCandles = this.candles.slice(-period - 1);
    let gains: Big[] = [];
    let losses: Big[] = [];

    for (let i = 1; i < rsiCandles.length; i++) {
      const diff = new Big(rsiCandles[i].close).minus(rsiCandles[i - 1].close);
      if (diff.gt(0)) gains.push(diff);
      else losses.push(diff.abs());
    }

    let avgGain = gains
      .slice(0, period)
      .reduce((acc, val) => acc.plus(val), new Big(0))
      .div(period);
    let avgLoss = losses
      .slice(0, period)
      .reduce((acc, val) => acc.plus(val), new Big(0))
      .div(period);

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

    if (avgLoss.eq(0)) return 100;

    const rs = avgGain.div(avgLoss);
    return Number(new Big(100).minus(new Big(100).div(rs.plus(1))));
  }

  getEma(period: number): number | null {
    if (this.candles.length < period) return null;

    const k = new Big(2).div(new Big(period + 1));
    let ema = new Big(this.candles[0].close);

    for (let i = 1; i < this.candles.length; i++) {
      ema = new Big(this.candles[i].close)
        .times(k)
        .plus(ema.times(new Big(1).minus(k)));
    }

    return Number(ema);
  }

  getPriceDiffToEma(currentPrice: number, period: number): number | null {
    const ema = this.getEma(period);
    if (ema === null) return null;
    return Number(new Big(currentPrice).minus(ema));
  }

  getPriceDiffPercentageToEma(
    currentPrice: number,
    period: number
  ): number | null {
    const ema = this.getEma(period);
    if (ema === null) return null;
    return Number(new Big(currentPrice).minus(ema).div(ema).times(100));
  }
}
