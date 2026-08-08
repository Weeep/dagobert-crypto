import type { NextApiRequest, NextApiResponse } from "next";
import { tradingBotUseCases } from "@/src/shared/composition/serverUseCases";
import { authenticatedUserId, bodyRecord } from "@/src/modules/bot/infrastructure/http/botApiHelpers";
import { toBotDto } from "@/src/modules/bot";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await authenticatedUserId(req, res); if (!userId) return;
  if (req.method === "GET") return res.status(200).json({ bots: (await tradingBotUseCases.listBots.execute(userId)).map(toBotDto) });
  if (req.method !== "POST") { res.setHeader("Allow", "GET, POST"); return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } }); }
  const b = bodyRecord(req.body); if (!b) return res.status(400).json({ error: { code: "BAD_REQUEST", message: "JSON object required" } });
  const result = await tradingBotUseCases.createBot.execute({ userId, name: String(b.name ?? ""), pairSymbol: String(b.pairSymbol ?? ""),
    assignedBudget: String(b.assignedBudget ?? ""), amountPerPosition: String(b.amountPerPosition ?? ""), timeframe: String(b.timeframe ?? ""),
    strategyVersionId: String(b.strategyVersionId ?? ""), mode: b.mode as never, feeRate: b.feeRate === undefined ? undefined : String(b.feeRate),
    slippageRate: b.slippageRate === undefined ? undefined : String(b.slippageRate) });
  return result.ok ? res.status(201).json({ bot: toBotDto(result.bot) }) : res.status(400).json({ error: { code: "VALIDATION_ERROR", message: result.error } });
}
