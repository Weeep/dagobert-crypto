import type { NextApiRequest, NextApiResponse } from "next";
import { authenticatedUserId } from "@/src/modules/bot/infrastructure/http/botApiHelpers";
import { prisma } from "@/src/shared/infrastructure/prisma/prisma";

export type BacktestAnatomyFill = { side: "BUY" | "SELL"; executed: string; price: string;
  amount: string; fee: string; filledAt: string };
export type BacktestAnatomyPosition = { id: string; profit: string | null; fills: BacktestAnatomyFill[] };
export type BacktestAnatomyRun = { id: string; bot: { name: string; pair: string; timeframe: string };
  strategy: { name: string; version: number | null; definition: unknown };
  status: string; from: string | null; to: string | null; startedAt: string; endedAt: string | null;
  candleCount: number; buyCount: number; sellCount: number; openBuyCount: number;
  initialBalance: string | null; netProfit: string | null;
  positions: BacktestAnatomyPosition[] };
export type BacktestAnatomyStrategy = { id: string; name: string; runs: BacktestAnatomyRun[] };

export interface BacktestAnatomyReader { listForUser(userId: string): Promise<BacktestAnatomyStrategy[]> }

export const prismaBacktestAnatomyReader: BacktestAnatomyReader = {
  async listForUser(userId) {
    const strategies = await prisma.strategy.findMany({
      where: { userId, versions: { some: { bots: { some: { runs: { some: { mode: "BACKTEST" } } } } } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, versions: { select: { bots: { select: {
        name: true, pairSymbol: true, timeframe: true,
        runs: { where: { mode: "BACKTEST" }, orderBy: { startedAt: "desc" }, select: {
          id: true, status: true, backtestFrom: true, backtestTo: true, startedAt: true, endedAt: true,
          configurationSnapshot: true, strategySnapshot: true,
          portfolioSnapshots: { orderBy: { sequenceNumber: "desc" }, take: 1, select: { totalEquity: true } },
          positions: { orderBy: { openedAt: "asc" }, select: {
            id: true, status: true, realizedPnl: true,
            orders: { orderBy: { submittedAt: "asc" }, select: {
              side: true, fills: { orderBy: { filledAt: "asc" }, select: {
                quantity: true, price: true, commission: true, filledAt: true,
              } },
            } },
          } },
        } },
      } } } } },
    });
    return Promise.all(strategies.map(async (strategy) => {
      const runPromises: Array<Promise<BacktestAnatomyRun>> = [];
      for (const version of strategy.versions) for (const bot of version.bots) for (const run of bot.runs) {
        runPromises.push((async () => {
        const strategySnapshot = record(run.strategySnapshot); const configuration = record(run.configurationSnapshot);
        const initialBalance = decimalString(configuration?.assignedBudget);
        const endingEquity = run.portfolioSnapshots[0]?.totalEquity;
        const fills = run.positions.flatMap((position) => position.orders.flatMap((order) => order.fills.map(() => order.side)));
        const candleCount = run.backtestFrom && run.backtestTo ? await prisma.candle.count({ where: {
          pairSymbol: bot.pairSymbol, interval: bot.timeframe, isClosed: true,
          openTime: { gte: run.backtestFrom, lte: run.backtestTo },
        } }) : 0;
          return {
            id: run.id, bot: { name: bot.name, pair: bot.pairSymbol, timeframe: bot.timeframe }, status: run.status,
            strategy: { name: strategy.name,
              version: typeof strategySnapshot?.version === "number" ? strategySnapshot.version : null,
              definition: strategySnapshot?.definition ?? run.strategySnapshot },
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
        })());
      }
      const runs = await Promise.all(runPromises);
      return { id: strategy.id, name: strategy.name,
        runs: runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt)) };
    }));
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
