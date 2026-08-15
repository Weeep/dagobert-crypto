import type { NextApiRequest, NextApiResponse } from "next";
import { authenticatedUserId } from "@/src/modules/bot/infrastructure/http/botApiHelpers";
import { tradingBotUseCases } from "@/src/shared/composition/serverUseCases";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
  const userId = await authenticatedUserId(req, res); if (!userId) return;
  const result = await tradingBotUseCases.getBotError.execute(userId, String(req.query.id ?? ""));
  return result.found ? res.status(200).json({ errorDetails: result.error })
    : res.status(404).json({ error: { code: "NOT_FOUND", message: "Bot not found" } });
}
