import { isMarketInterval } from "../domain/Candle";
import type {
  MarketDataSubscription,
  MarketDataSubscriptionRepository,
} from "../domain/MarketDataSubscription";

export class DiscoverMarketDataSubscriptionsUseCase {
  constructor(
    private readonly repository: MarketDataSubscriptionRepository,
    private readonly configured: readonly MarketDataSubscription[] = [],
  ) {}

  async execute(): Promise<MarketDataSubscription[]> {
    const discovered = await this.repository.findActive();
    const unique = new Map<string, MarketDataSubscription>();
    for (const subscription of [...discovered, ...this.configured]) {
      const pairSymbol = subscription.pairSymbol.trim().toUpperCase();
      if (!/^[A-Z0-9]+USDC$/.test(pairSymbol))
        throw new Error(`Invalid market-data subscription symbol: ${subscription.pairSymbol}`);
      if (!isMarketInterval(subscription.interval))
        throw new Error(`Invalid market-data subscription interval: ${subscription.interval}`);
      unique.set(`${pairSymbol}:${subscription.interval}`, { pairSymbol, interval: subscription.interval });
    }
    return Array.from(unique.values()).sort((left, right) =>
      left.pairSymbol.localeCompare(right.pairSymbol) || left.interval.localeCompare(right.interval));
  }
}
