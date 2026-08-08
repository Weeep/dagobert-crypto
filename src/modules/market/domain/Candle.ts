export const MARKET_INTERVALS = ["1h", "4h", "1d"] as const;
export type MarketInterval = (typeof MARKET_INTERVALS)[number];

export const MARKET_INTERVAL_MILLISECONDS: Record<MarketInterval, number> = {
  "1h": 60 * 60 * 1_000,
  "4h": 4 * 60 * 60 * 1_000,
  "1d": 24 * 60 * 60 * 1_000,
};

export function isMarketInterval(value: string): value is MarketInterval {
  return MARKET_INTERVALS.includes(value as MarketInterval);
}

export type Candle = {
  id: string; pairSymbol: string; interval: MarketInterval; openTime: Date; closeTime: Date;
  open: string; high: string; low: string; close: string; volume: string;
  quoteVolume: string; trades: number; isClosed: boolean; source: string; receivedAt: Date;
};
