import type { NextApiRequest, NextApiResponse } from "next";
import type { BotStatus } from "../../domain/TradingBot";
import { tradingBotUseCases } from "@/src/shared/composition/serverUseCases";
import { authenticatedUserId } from "./botApiHelpers";
import { toBotDto } from "../../dto/BotDto";
export const statusHandler = (status: Extract<BotStatus, "PAUSED" | "STOPPED">) => async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).end(); }
  const userId = await authenticatedUserId(req, res); if (!userId) return; const id = String(req.query.id ?? "");
  if (!await tradingBotUseCases.getBot.execute(userId, id)) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Bot not found" } });
  const result = await tradingBotUseCases.setBotStatus.execute(id, status);
  return result.ok ? res.json({ bot: toBotDto(result.bot) }) : res.status(409).json({ error: { code: "INVALID_TRANSITION", message: result.error } });
};
