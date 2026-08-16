import type { NextApiRequest, NextApiResponse } from "next";
import { authenticatedUserId, bodyRecord } from "@/src/modules/bot/infrastructure/http/botApiHelpers";
import { tradingBotUseCases } from "@/src/shared/composition/serverUseCases";
import { backtestFailureMessage, type HistoricalBacktestProgress } from "@/src/modules/bot";

type Dependencies = Pick<typeof tradingBotUseCases, "runBacktest">;
export const config = { api: { responseLimit: false } };

export const createBacktestsHandler = (useCases: Dependencies = tradingBotUseCases,
  authenticate: typeof authenticatedUserId = authenticatedUserId) => async function handler(
  req: NextApiRequest, res: NextApiResponse,
) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({
    error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } }); }
  const userId = await authenticate(req, res); if (!userId) return;
  const body = bodyRecord(req.body);
  if (!body || typeof body.from !== "string" || typeof body.to !== "string")
    return res.status(400).json({ error: { code: "BAD_REQUEST", message: "from and to ISO timestamps are required" } });
  const range = { from: new Date(body.from), to: new Date(body.to) };
  if (body.includeFullTimeline !== undefined && typeof body.includeFullTimeline !== "boolean")
    return res.status(400).json({ error: { code: "BAD_REQUEST", message: "includeFullTimeline must be a boolean" } });
  const includeFullTimeline = body.includeFullTimeline === true;
  const streaming = req.query.stream === "1";
  const send = (event: unknown) => res.write(`${JSON.stringify(event)}\n`);
  if (streaming) {
    res.status(200); res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform"); res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
  }
  try {
    const result = await useCases.runBacktest.execute(userId, String(req.query.id ?? ""), range,
      streaming ? (progress: HistoricalBacktestProgress) => send({ type: "progress", progress }) : undefined,
      includeFullTimeline);
    if (streaming) {
      if (!result.ok) send({ type: "error", message: result.error });
      else {
        const { decisions, fills, ...summary } = result.result;
        for (const [field, items] of Object.entries({ decisions, fills }))
          for (let offset = 0; offset < items.length; offset += 100)
            send({ type: "result-chunk", field, items: items.slice(offset, offset + 100) });
        send({ type: "complete", backtest: { ...summary, decisions: [], fills: [] } });
      }
      return res.end();
    }
    if (!result.ok) return res.status(result.status).json({ error: {
      code: result.status === 404 ? "NOT_FOUND" : result.status === 400 ? "BAD_REQUEST" : "BACKTEST_REJECTED",
      message: result.error,
    } });
    return res.status(200).json({ backtest: result.result });
  } catch (error) {
    if (streaming) { send({ type: "error", message: backtestFailureMessage(error) }); return res.end(); }
    return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Backtest execution failed" } });
  }
};

export default createBacktestsHandler();
