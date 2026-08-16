import type { NextApiRequest, NextApiResponse } from "next";
import { authenticatedUserId } from "@/src/modules/bot/infrastructure/http/botApiHelpers";
import { prisma } from "@/src/shared/infrastructure/prisma/prisma";

export type BacktestAnatomyFill = { side: "BUY" | "SELL"; executed: string; price: string;
  amount: string; fee: string; filledAt: string };
export type BacktestAnatomyPosition = { id: string; profit: string | null; fills: BacktestAnatomyFill[] };
export type BacktestAnatomyRun = { id: string; bot: { name: string; pair: string; timeframe: string };
  status: string; from: string | null; to: string | null; startedAt: string; endedAt: string | null;
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
    return strategies.map((strategy) => ({ id: strategy.id, name: strategy.name,
      runs: strategy.versions.flatMap((version) => version.bots.flatMap((bot) => bot.runs.map((run) => ({
        id: run.id, bot: { name: bot.name, pair: bot.pairSymbol, timeframe: bot.timeframe }, status: run.status,
        from: run.backtestFrom?.toISOString() ?? null, to: run.backtestTo?.toISOString() ?? null,
        startedAt: run.startedAt.toISOString(), endedAt: run.endedAt?.toISOString() ?? null,
        positions: run.positions.map((position) => ({ id: position.id,
          profit: position.status === "CLOSED" ? position.realizedPnl.toString() : null,
          fills: position.orders.flatMap((order) => order.fills.map((fill) => ({ side: order.side,
            executed: fill.quantity.toString(), price: fill.price.toString(),
            amount: fill.quantity.mul(fill.price).toString(), fee: fill.commission.toString(),
            filledAt: fill.filledAt.toISOString(),
          }))),
        })),
      })))).sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    }));
  },
};

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
