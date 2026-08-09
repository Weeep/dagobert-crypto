import type { MarketDataSubscription } from "./MarketDataSubscription";

export type MarketDataLeaseKey = MarketDataSubscription & { source: string };

export interface MarketDataLease {
  withLease<T>(key: MarketDataLeaseKey, work: () => Promise<T>): Promise<T | null>;
}

