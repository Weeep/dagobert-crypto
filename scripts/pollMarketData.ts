import dotenv from "dotenv";
import type { MarketDataPollingOutcome, MarketDataSubscription } from "@/src/modules/market";
import { DiscoverMarketDataSubscriptionsUseCase, isMarketInterval,
  MarketDataPollingWorker, PollClosedCandlesUseCase } from "@/src/modules/market";

export const MARKET_DATA_ENV_FILES = [".env.local", ".env"] as const;

// Keep Next.js' local override first, while also supporting the conventional
// .env file used by Prisma and command-line deployments.
dotenv.config({ path: [...MARKET_DATA_ENV_FILES], quiet: true });

type PollerConfiguration = {
  once: boolean;
  subscriptions: MarketDataSubscription[];
  closeGraceMs: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
  discoveryIntervalMs: number;
  maxCandlesPerPoll: number;
  leaseTimeoutMs: number;
  maxCursorLagIntervals: number;
  maxClockOffsetMs: number;
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
    "discovery-interval-ms", "max-candles-per-poll", "lease-timeout-ms",
    "max-cursor-lag-intervals", "max-clock-offset-ms"]);
  for (const name of Array.from(values.keys())) if (!known.has(name)) throw new Error(`Unknown option: --${name}`);
  if (!environment.DATABASE_URL?.trim()) throw new Error("DATABASE_URL is required");
  const configuration = {
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
    maxCursorLagIntervals: integer(values.get("max-cursor-lag-intervals") ??
      environment.MARKET_DATA_MAX_CURSOR_LAG_INTERVALS, 1, "maxCursorLagIntervals"),
    maxClockOffsetMs: integer(values.get("max-clock-offset-ms") ??
      environment.MARKET_DATA_MAX_CLOCK_OFFSET_MS, 5_000, "maxClockOffsetMs"),
  };
  if (configuration.maxBackoffMs < configuration.baseBackoffMs)
    throw new Error("maxBackoffMs must be greater than or equal to baseBackoffMs");
  return configuration;
}

const SENSITIVE_ENVIRONMENT_KEYS = ["BAPI_KEY", "BAPI_SEC"] as const;

export const serializeForLog = (value: unknown,
  environment: Record<string, string | undefined> = process.env) => {
  let serialized = JSON.stringify(value, (key, item) => {
    if (/api[-_]?key|api[-_]?secret|credential|password|secret/i.test(key)) return "[REDACTED]";
    return typeof item === "bigint" ? item.toString() : item instanceof Date ? item.toISOString() : item;
  });
  for (const key of SENSITIVE_ENVIRONMENT_KEYS) {
    const secret = environment[key];
    if (secret) serialized = serialized.replaceAll(secret, "[REDACTED]");
  }
  return serialized;
};

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
      new PrismaMarketDataLease(prisma, configuration.leaseTimeoutMs), undefined,
      { maxCursorLagIntervals: configuration.maxCursorLagIntervals,
        maxClockOffsetMs: configuration.maxClockOffsetMs });
    const discover = new DiscoverMarketDataSubscriptionsUseCase(
      new PrismaMarketDataSubscriptionRepository(prisma), configuration.subscriptions);
    const report = (outcome: MarketDataPollingOutcome) => {
      process.stderr.write(`${serializeForLog({ event: "market-data-poll", ...outcome })}\n`);
    };
    const worker = new MarketDataPollingWorker(discover, poll, configuration, undefined, undefined,
      undefined, configuration.once ? undefined : report);
    if (configuration.once) {
      const outcomes = await worker.runOnce(abortController.signal);
      process.stdout.write(`${serializeForLog({ status: "completed", outcomes })}\n`);
    } else await worker.run(abortController.signal);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) main().catch((error) => {
  process.stderr.write(`${serializeForLog({ event: "market-data-poll-fatal",
    error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exitCode = 1;
});
