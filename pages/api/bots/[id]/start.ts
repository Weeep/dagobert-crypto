import type { NextApiRequest, NextApiResponse } from "next";
import { tradingBotUseCases } from "@/src/shared/composition/serverUseCases";
import { authenticatedUserId, bodyRecord } from "@/src/modules/bot/infrastructure/http/botApiHelpers";
import { toBotRunDto } from "@/src/modules/bot";
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).end(); }
  const userId = await authenticatedUserId(req, res); if (!userId) return;
  const id = String(req.query.id ?? ""); if (!await tradingBotUseCases.getBot.execute(userId, id)) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Bot not found" } });
  const b = bodyRecord(req.body) ?? {}; const range = b.from && b.to ? { from: new Date(String(b.from)), to: new Date(String(b.to)) } : undefined;
  const result = await tradingBotUseCases.startBot.execute(id, range);
  return result.ok ? res.status(201).json({ run: toBotRunDto(result.run) }) : res.status(409).json({ error: { code: "INVALID_TRANSITION", message: result.error } });
}
