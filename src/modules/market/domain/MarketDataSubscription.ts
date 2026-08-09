import type { MarketInterval } from "./Candle";

export type MarketDataSubscription = {
  pairSymbol: string;
  interval: MarketInterval;
};

export interface MarketDataSubscriptionRepository {
  findActive(): Promise<MarketDataSubscription[]>;
}

