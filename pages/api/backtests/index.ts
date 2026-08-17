import type { NextApiRequest, NextApiResponse } from "next";
import { authenticatedUserId } from "@/src/modules/bot/infrastructure/http/botApiHelpers";
import { prisma } from "@/src/shared/infrastructure/prisma/prisma";

export type BacktestAnatomyFill = { side: "BUY" | "SELL"; executed: string; price: string;
  amount: string; fee: string; filledAt: string };
export type BacktestAnatomyPosition = { id: string; profit: string | null; fills: BacktestAnatomyFill[] };
export type BacktestAnatomyRun = { id: string; bot: { name: string; pair: string; timeframe: string };
  status: string; from: string | null; to: string | null; startedAt: string; endedAt: string | null;
  candleCount: number; buyCount: number; sellCount: number; openBuyCount: number;
  initialBalance: string | null; netProfit: string | null;
  positions: BacktestAnatomyPosition[] };
export type BacktestAnatomyVersion = { version: number | null; definition: unknown; runs: BacktestAnatomyRun[] };
export type BacktestAnatomyStrategy = { id: string; name: string; versions: BacktestAnatomyVersion[] };

export interface BacktestAnatomyReader { listForUser(userId: string): Promise<BacktestAnatomyStrategy[]> }

export function backtestStrategyIdentity(snapshot: unknown,
  fallback: { id: string; name: string; version: number }) {
  const strategySnapshot = record(snapshot); const definition = strategySnapshot?.definition ?? snapshot;
  const definitionRecord = record(definition);
  return {
    id: typeof strategySnapshot?.strategyId === "string" ? strategySnapshot.strategyId : fallback.id,
    name: typeof definitionRecord?.name === "string" ? definitionRecord.name : fallback.name,
    version: typeof strategySnapshot?.version === "number" ? strategySnapshot.version : fallback.version,
    definition,
  };
}

export const prismaBacktestAnatomyReader: BacktestAnatomyReader = {
  async listForUser(userId) {
    const runs = await prisma.botRun.findMany({
      where: { mode: "BACKTEST", bot: { userId } }, orderBy: { startedAt: "desc" },
      select: { id: true, status: true, backtestFrom: true, backtestTo: true, startedAt: true, endedAt: true,
        configurationSnapshot: true, strategySnapshot: true,
        bot: { select: { name: true, pairSymbol: true, timeframe: true, strategyVersion: {
          select: { version: true, strategy: { select: { id: true, name: true } } },
        } } },
        portfolioSnapshots: { orderBy: { sequenceNumber: "desc" }, take: 1, select: { totalEquity: true } },
        positions: { orderBy: { openedAt: "asc" }, select: {
          id: true, status: true, realizedPnl: true,
          orders: { orderBy: { submittedAt: "asc" }, select: {
            side: true, fills: { orderBy: { filledAt: "asc" }, select: {
              quantity: true, price: true, commission: true, filledAt: true,
            } },
          } },
        } },
      },
    });
    const grouped = new Map<string, BacktestAnatomyStrategy>();
    await Promise.all(runs.map(async (run) => {
        const configuration = record(run.configurationSnapshot);
        const identity = backtestStrategyIdentity(run.strategySnapshot, { id: run.bot.strategyVersion.strategy.id,
          name: run.bot.strategyVersion.strategy.name, version: run.bot.strategyVersion.version });
        const initialBalance = decimalString(configuration?.assignedBudget);
        const endingEquity = run.portfolioSnapshots[0]?.totalEquity;
        const fills = run.positions.flatMap((position) => position.orders.flatMap((order) => order.fills.map(() => order.side)));
        const candleCount = run.backtestFrom && run.backtestTo ? await prisma.candle.count({ where: {
          pairSymbol: run.bot.pairSymbol, interval: run.bot.timeframe, isClosed: true,
          openTime: { gte: run.backtestFrom, lte: run.backtestTo },
        } }) : 0;
        const mappedRun: BacktestAnatomyRun = {
            id: run.id, bot: { name: run.bot.name, pair: run.bot.pairSymbol, timeframe: run.bot.timeframe }, status: run.status,
            from: run.backtestFrom?.toISOString() ?? null, to: run.backtestTo?.toISOString() ?? null,
            startedAt: run.startedAt.toISOString(), endedAt: run.endedAt?.toISOString() ?? null,
            candleCount, buyCount: fills.filter((side) => side === "BUY").length,
            sellCount: fills.filter((side) => side === "SELL").length,
            openBuyCount: run.positions.filter((position) => position.status !== "CLOSED").length,
            initialBalance,
            netProfit: initialBalance && endingEquity ? endingEquity.minus(initialBalance).toString() : null,
            positions: run.positions.map((position) => ({ id: position.id,
              profit: position.status === "CLOSED" ? position.realizedPnl.toString() : null,
              fills: position.orders.flatMap((order) => order.fills.map((fill) => ({ side: order.side,
                executed: fill.quantity.toString(), price: fill.price.toString(),
                amount: fill.quantity.mul(fill.price).toString(), fee: fill.commission.toString(),
                filledAt: fill.filledAt.toISOString(),
              }))),
            })),
        };
        let strategy = grouped.get(identity.id);
        if (!strategy) { strategy = { id: identity.id, name: identity.name, versions: [] }; grouped.set(identity.id, strategy); }
        let version = strategy.versions.find((candidate) => candidate.version === identity.version);
        if (!version) { version = { version: identity.version, definition: identity.definition, runs: [] }; strategy.versions.push(version); }
        version.runs.push(mappedRun);
    }));
    return Array.from(grouped.values()).map((strategy) => ({ ...strategy,
      versions: strategy.versions.map((version) => ({ ...version,
        runs: version.runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
      })).sort((a, b) => (b.version ?? -1) - (a.version ?? -1)),
    })).sort((a, b) => a.name.localeCompare(b.name));
  },
};

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
const decimalString = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value) : null;

export const createBacktestAnatomyHandler = (reader: BacktestAnatomyReader = prismaBacktestAnatomyReader,
  authenticate: typeof authenticatedUserId = authenticatedUserId) => async function handler(
  req: NextApiRequest, res: NextApiResponse,
) {
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({
    error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" },
  }); }
  const userId = await authenticate(req, res); if (!userId) return;
  try { return res.status(200).json({ strategies: await reader.listForUser(userId) }); }
  catch { return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Backtest history could not be loaded" } }); }
};

export default createBacktestAnatomyHandler();
