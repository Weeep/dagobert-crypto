import type { Candle, MarketInterval } from "./Candle";

export type HistoricalCandleRequest = {
  pairSymbol: string;
  interval: MarketInterval;
  from: Date;
  to: Date;
  pageSize?: number;
  signal?: AbortSignal;
};

export type HistoricalCandleBatch = {
  candles: Candle[];
  serverTime: Date;
  clockOffsetMs: bigint;
};

export interface MarketDataSource {
  fetchServerTime(signal?: AbortSignal): Promise<{ serverTime: Date; clockOffsetMs: bigint }>;
  fetchHistoricalCandles(request: HistoricalCandleRequest): Promise<HistoricalCandleBatch>;
}
