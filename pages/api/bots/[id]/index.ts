import type { NextApiRequest, NextApiResponse } from "next";
import { tradingBotUseCases } from "@/src/shared/composition/serverUseCases";
import { authenticatedUserId, bodyRecord } from "@/src/modules/bot/infrastructure/http/botApiHelpers";
import { toBotDto } from "@/src/modules/bot";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await authenticatedUserId(req, res); if (!userId) return;
  const id = String(req.query.id ?? "");
  if (req.method === "GET") { const bot = await tradingBotUseCases.getBot.execute(userId, id); return bot ? res.json({ bot: toBotDto(bot) }) : res.status(404).json({ error: { code: "NOT_FOUND", message: "Bot not found" } }); }
  if (req.method !== "PATCH") { res.setHeader("Allow", "GET, PATCH"); return res.status(405).end(); }
  const body = bodyRecord(req.body); if (!body) return res.status(400).json({ error: { code: "BAD_REQUEST", message: "JSON object required" } });
  const stringFields = ["name", "pairSymbol", "assignedBudget", "amountPerPosition", "timeframe", "strategyVersionId", "feeRate", "slippageRate"] as const;
  const input: Record<string, unknown> = {};
  for (const field of stringFields) if (body[field] !== undefined) input[field] = String(body[field]);
  if (body.mode !== undefined) input.mode = String(body.mode);
  const result = await tradingBotUseCases.updateBot.execute(userId, id, input as never);
  return result.ok ? res.json({ bot: toBotDto(result.bot) }) : res.status(result.error === "Bot not found" ? 404 : 400).json({ error: { code: "VALIDATION_ERROR", message: result.error } });
}
