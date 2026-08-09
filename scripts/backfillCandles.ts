import dotenv from "dotenv";
import type { MarketInterval } from "@/src/modules/market";
import { BackfillCandlesUseCase, isMarketInterval } from "@/src/modules/market";

dotenv.config({ path: ".env.local", quiet: true });

type CliOptions = {
  symbol?: string;
  interval?: string;
  start?: string;
  end?: string;
  pageSize?: string;
  maxPages?: string;
  dryRun: boolean;
};

function parseArguments(arguments_: string[]): CliOptions {
  const options: CliOptions = { dryRun: false };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    // `npm run command --symbol SOLUSDC` consumes `--symbol` itself and forwards
    // only `SOLUSDC`. Accept that single positional value as a convenience,
    // while `npm run command -- --symbol SOLUSDC` remains the canonical form.
    if (!argument.startsWith("--")) {
      if (!options.symbol) {
        options.symbol = argument;
        continue;
      }
      throw new Error(`Unexpected argument: ${argument}`);
    }
    const [rawName, inlineValue] = argument.slice(2).split("=", 2);
    const value = inlineValue ?? arguments_[index + 1];
    if (inlineValue === undefined) index += 1;
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${rawName}`);
    const name = rawName.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
    if (!["symbol", "interval", "start", "end", "pageSize", "maxPages"].includes(name))
      throw new Error(`Unknown option: --${rawName}`);
    Object.assign(options, { [name]: value });
  }
  return options;
}

function date(value: string | undefined, name: string): Date | undefined {
  if (value === undefined) return undefined;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`--${name} must be an ISO-8601 date`);
  return parsed;
}

function integer(value: string | undefined): number | undefined {
  return value === undefined ? undefined : Number(value);
}

function serialize(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item instanceof Date ? item.toISOString() : item, 2);
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  if (!options.symbol) throw new Error("--symbol is required");
  if (!options.interval || !isMarketInterval(options.interval))
    throw new Error("--interval must be one of: 15m, 1h, 4h, 1d");

  const [{ binanceClient }, { BinanceRestMarketDataSource }, { PrismaCandleRepository }, { prisma }] =
    await Promise.all([
      import("@/src/modules/exchange/infrastructure/binanceClient"),
      import("@/src/modules/market/infrastructure/binance/BinanceRestMarketDataSource"),
      import("@/src/modules/market/infrastructure/prisma/PrismaCandleRepository"),
      import("@/src/shared/infrastructure/prisma/prisma"),
    ]);
  try {
    const repository = new PrismaCandleRepository(prisma);
    const useCase = new BackfillCandlesUseCase(repository, repository,
      new BinanceRestMarketDataSource(binanceClient));
    const result = await useCase.execute({
      pairSymbol: options.symbol,
      interval: options.interval as MarketInterval,
      start: date(options.start, "start"),
      end: date(options.end, "end"),
      pageSize: integer(options.pageSize),
      maxPages: integer(options.maxPages),
      dryRun: options.dryRun,
    });
    process.stdout.write(`${serialize(result)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
