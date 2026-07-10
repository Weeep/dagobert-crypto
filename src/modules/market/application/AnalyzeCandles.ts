import { TradingAnalysis } from "../domain/TradingAnalysis";
import type { DCandle } from "../domain/TradingAnalysis";

export function analyzeCandles(candles: DCandle[], currentPrice: number): DCandle[] {
  return new TradingAnalysis(candles, currentPrice).extend();
}
