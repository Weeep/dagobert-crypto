import type { NextApiRequest, NextApiResponse } from "next";
import { authenticatedUserId, bodyRecord } from "@/src/modules/bot/infrastructure/http/botApiHelpers";
import { runWorkbench } from "@/src/modules/bot/application/BacktestWorkbench";
import { isMarketInterval } from "@/src/modules/market";
import { postgresRepositories } from "@/src/shared/composition/serverUseCases";

export const config = { api: { responseLimit: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: { message: "Method not allowed" } }); }
  const userId = await authenticatedUserId(req, res); if (!userId) return;
  const body = bodyRecord(req.body); const rows = body?.rows;
  const from = typeof body?.from === "string" ? new Date(body.from) : new Date(NaN);
  const to = typeof body?.to === "string" ? new Date(body.to) : new Date(NaN);
  if (!body || !Array.isArray(rows) || !Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to)
    return res.status(400).json({ error: { message: "Strategy, rows, and a valid ascending range are required" } });
  const parsedRows = rows.flatMap((raw) => {
    const row = bodyRecord(raw);
    return row && typeof row.id === "string" && typeof row.pairSymbol === "string" &&
      typeof row.timeframe === "string" && isMarketInterval(row.timeframe)
      ? [{ id: row.id, pairSymbol: row.pairSymbol, timeframe: row.timeframe }] : [];
  });
  if (!parsedRows.length || parsedRows.length !== rows.length)
    return res.status(400).json({ error: { message: "Every row needs a supported pair and timeframe" } });
  try { return res.status(200).json(await runWorkbench({ userId, definition: body.definition, from, to,
    rows: parsedRows }, postgresRepositories.candleRepository)); }
  catch (error) { return res.status(422).json({ error: { message: error instanceof Error ? error.message : "Backtest failed" } }); }
}
