import type { NextApiRequest, NextApiResponse } from "next";
import { authenticatedUserId, bodyRecord } from "@/src/modules/bot/infrastructure/http/botApiHelpers";
import { tradingBotUseCases } from "@/src/shared/composition/serverUseCases";

type Dependencies = Pick<typeof tradingBotUseCases, "runBacktest">;

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
  try {
    const result = await useCases.runBacktest.execute(userId, String(req.query.id ?? ""), range);
    if (!result.ok) return res.status(result.status).json({ error: {
      code: result.status === 404 ? "NOT_FOUND" : result.status === 400 ? "BAD_REQUEST" : "BACKTEST_REJECTED",
      message: result.error,
    } });
    return res.status(200).json({ backtest: result.result });
  } catch {
    return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Backtest execution failed" } });
  }
};

export default createBacktestsHandler();
