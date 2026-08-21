import type { NextApiRequest, NextApiResponse } from "next";
import { authenticatedUserId } from "@/src/modules/bot/infrastructure/http/botApiHelpers";
import { strategyApiError, strategyMethodNotAllowed } from "@/src/modules/strategy/infrastructure/http/strategyApiHelpers";
import { prisma } from "@/src/shared/infrastructure/prisma/prisma";
import { backtestStrategyIdentity } from "@/pages/api/backtests";

export type StrategyPerformanceDto = { strategyId: string; profitableRuns: number; losingRuns: number };

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return strategyMethodNotAllowed(res, ["GET"]);
  const userId = await authenticatedUserId(req, res); if (!userId) return;
  try {
    const runs = await prisma.botRun.findMany({ where: { mode: "BACKTEST", bot: { userId } }, select: {
      configurationSnapshot: true, strategySnapshot: true,
      portfolioSnapshots: { orderBy: { sequenceNumber: "desc" }, take: 1, select: { totalEquity: true } },
      bot: { select: { strategyVersion: { select: { version: true,
        strategy: { select: { id: true, name: true } },
      } } } },
    } });
    const totals = new Map<string, StrategyPerformanceDto>();
    for (const run of runs) {
      const fallback = run.bot.strategyVersion;
      const identity = backtestStrategyIdentity(run.strategySnapshot, {
        id: fallback.strategy.id, name: fallback.strategy.name, version: fallback.version,
      });
      const current = totals.get(identity.id) ?? { strategyId: identity.id, profitableRuns: 0, losingRuns: 0 };
      const initialValue = record(run.configurationSnapshot)?.assignedBudget;
      const initial = typeof initialValue === "string" || typeof initialValue === "number" ? Number(initialValue) : NaN;
      const ending = run.portfolioSnapshots[0] ? Number(run.portfolioSnapshots[0].totalEquity.toString()) : NaN;
      if (Number.isFinite(initial) && Number.isFinite(ending)) {
        if (ending > initial) current.profitableRuns += 1;
        if (ending < initial) current.losingRuns += 1;
      }
      totals.set(identity.id, current);
    }
    return res.status(200).json({ performance: Array.from(totals.values()) });
  } catch { return strategyApiError(res, 500, "INTERNAL_ERROR", "Strategy performance could not be loaded"); }
}
