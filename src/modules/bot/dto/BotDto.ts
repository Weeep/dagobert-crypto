import type { BotRun, TradingBot } from "../domain/TradingBot";

export type BotDto = Omit<TradingBot, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export type BotRunDto = Omit<BotRun, "startedAt" | "endedAt" | "backtestFrom" | "backtestTo"> & {
  startedAt: string;
  endedAt: string | null;
  backtestFrom: string | null;
  backtestTo: string | null;
};

export function toBotDto(bot: TradingBot): BotDto {
  return { ...bot, createdAt: bot.createdAt.toISOString(), updatedAt: bot.updatedAt.toISOString() };
}

export function toBotRunDto(run: BotRun): BotRunDto {
  return {
    ...run,
    startedAt: run.startedAt.toISOString(),
    endedAt: run.endedAt?.toISOString() ?? null,
    backtestFrom: run.backtestFrom?.toISOString() ?? null,
    backtestTo: run.backtestTo?.toISOString() ?? null,
  };
}
