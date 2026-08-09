/** Intervals supported consistently by bots, persisted market data and exchange adapters. */
export const MARKET_INTERVALS = ["15m", "1h", "4h", "1d"] as const;

export type MarketInterval = (typeof MARKET_INTERVALS)[number];

export const MARKET_INTERVAL_MILLISECONDS: Record<MarketInterval, number> = {
  "15m": 15 * 60 * 1_000,
  "1h": 60 * 60 * 1_000,
  "4h": 4 * 60 * 60 * 1_000,
  "1d": 24 * 60 * 60 * 1_000,
};

export function isMarketInterval(value: string): value is MarketInterval {
  return MARKET_INTERVALS.includes(value as MarketInterval);
}
