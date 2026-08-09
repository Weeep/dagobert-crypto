import dotenv from "dotenv";
import type { MarketDataPollingOutcome, MarketDataSubscription } from "@/src/modules/market";
import { DiscoverMarketDataSubscriptionsUseCase, isMarketInterval,
  MarketDataPollingWorker, PollClosedCandlesUseCase } from "@/src/modules/market";

dotenv.config({ path: ".env.local", quiet: true });

type PollerConfiguration = {
  once: boolean;
  subscriptions: MarketDataSubscription[];
  closeGraceMs: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
  discoveryIntervalMs: number;
  maxCandlesPerPoll: number;
  leaseTimeoutMs: number;
};

const integer = (value: string | undefined, fallback: number, name: string) => {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
  return parsed;
};

export function parseSubscriptions(value: string | undefined): MarketDataSubscription[] {
  if (!value?.trim()) return [];
  return value.split(",").map((item) => {
    const [rawSymbol, interval, extra] = item.trim().split(":");
    const pairSymbol = rawSymbol?.trim().toUpperCase();
    if (extra !== undefined || !pairSymbol || !/^[A-Z0-9]+USDC$/.test(pairSymbol) ||
      !interval || !isMarketInterval(interval))
      throw new Error(`Invalid subscription '${item}'; expected SYMBOL:15m|1h|4h|1d`);
    return { pairSymbol, interval };
  });
}

export function parseConfiguration(arguments_: string[],
  environment: Record<string, string | undefined> = process.env): PollerConfiguration {
  const values = new Map<string, string>();
  let once = environment.MARKET_DATA_ONCE === "true";
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--once") { once = true; continue; }
    if (!argument.startsWith("--")) throw new Error(`Unexpected argument: ${argument}`);
    const [name, inlineValue] = argument.slice(2).split("=", 2);
    const value = inlineValue ?? arguments_[++index];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${name}`);
    values.set(name, value);
  }
  const known = new Set(["subscriptions", "close-grace-ms", "base-backoff-ms", "max-backoff-ms",
    "discovery-interval-ms", "max-candles-per-poll", "lease-timeout-ms"]);
  for (const name of Array.from(values.keys())) if (!known.has(name)) throw new Error(`Unknown option: --${name}`);
  return {
    once,
    subscriptions: parseSubscriptions(values.get("subscriptions") ?? environment.MARKET_DATA_SUBSCRIPTIONS),
    closeGraceMs: integer(values.get("close-grace-ms") ?? environment.MARKET_DATA_CLOSE_GRACE_MS,
      5_000, "closeGraceMs"),
    baseBackoffMs: integer(values.get("base-backoff-ms") ?? environment.MARKET_DATA_BASE_BACKOFF_MS,
      1_000, "baseBackoffMs"),
    maxBackoffMs: integer(values.get("max-backoff-ms") ?? environment.MARKET_DATA_MAX_BACKOFF_MS,
      60_000, "maxBackoffMs"),
    discoveryIntervalMs: integer(values.get("discovery-interval-ms") ??
      environment.MARKET_DATA_DISCOVERY_INTERVAL_MS, 60_000, "discoveryIntervalMs"),
    maxCandlesPerPoll: integer(values.get("max-candles-per-poll") ??
      environment.MARKET_DATA_MAX_CANDLES_PER_POLL, 1_000, "maxCandlesPerPoll"),
    leaseTimeoutMs: integer(values.get("lease-timeout-ms") ?? environment.MARKET_DATA_LEASE_TIMEOUT_MS,
      15 * 60_000, "leaseTimeoutMs"),
  };
}

const serialize = (value: unknown) => JSON.stringify(value, (_key, item) =>
  typeof item === "bigint" ? item.toString() : item instanceof Date ? item.toISOString() : item);

async function main(): Promise<void> {
  const configuration = parseConfiguration(process.argv.slice(2));
  const [{ binanceClient }, { BinanceRestMarketDataSource }, { PrismaCandleRepository },
    { PrismaMarketDataLease }, { PrismaMarketDataSubscriptionRepository }, { prisma }] = await Promise.all([
    import("@/src/modules/exchange/infrastructure/binanceClient"),
    import("@/src/modules/market/infrastructure/binance/BinanceRestMarketDataSource"),
    import("@/src/modules/market/infrastructure/prisma/PrismaCandleRepository"),
    import("@/src/modules/market/infrastructure/prisma/PrismaMarketDataLease"),
    import("@/src/modules/market/infrastructure/prisma/PrismaMarketDataSubscriptionRepository"),
    import("@/src/shared/infrastructure/prisma/prisma"),
  ]);
  const abortController = new AbortController();
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => abortController.abort());
  try {
    const repository = new PrismaCandleRepository(prisma);
    const poll = new PollClosedCandlesUseCase(repository, repository,
      new BinanceRestMarketDataSource(binanceClient),
      new PrismaMarketDataLease(prisma, configuration.leaseTimeoutMs));
    const discover = new DiscoverMarketDataSubscriptionsUseCase(
      new PrismaMarketDataSubscriptionRepository(prisma), configuration.subscriptions);
    const report = (outcome: MarketDataPollingOutcome) => {
      process.stderr.write(`${serialize({ event: "market-data-poll", ...outcome })}\n`);
    };
    const worker = new MarketDataPollingWorker(discover, poll, configuration, undefined, undefined,
      undefined, configuration.once ? undefined : report);
    if (configuration.once) {
      const outcomes = await worker.runOnce(abortController.signal);
      process.stdout.write(`${serialize({ status: "completed", outcomes })}\n`);
    } else await worker.run(abortController.signal);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
