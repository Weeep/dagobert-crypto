import type { MarketInterval } from "@/src/shared/domain/MarketInterval";

export type { MarketInterval } from "@/src/shared/domain/MarketInterval";
export {
  isMarketInterval,
  MARKET_INTERVALS,
  MARKET_INTERVAL_MILLISECONDS,
} from "@/src/shared/domain/MarketInterval";

export type Candle = {
  id: string; pairSymbol: string; interval: MarketInterval; openTime: Date; closeTime: Date;
  open: string; high: string; low: string; close: string; volume: string;
  quoteVolume: string; trades: number; isClosed: boolean; source: string; receivedAt: Date;
};
