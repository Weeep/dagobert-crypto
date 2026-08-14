import type { NextApiRequest, NextApiResponse } from "next";
import { authenticatedUserId } from "@/src/modules/bot/infrastructure/http/botApiHelpers";
import { toBotDto } from "@/src/modules/bot";
import { strategyApiError, strategyBody, strategyMethodNotAllowed, withStrategyApiErrors } from "@/src/modules/strategy/infrastructure/http/strategyApiHelpers";
import { tradingBotUseCases } from "@/src/shared/composition/serverUseCases";

type Dependencies = Pick<typeof tradingBotUseCases, "activateStrategyVersion">;
export const createActivateStrategyVersionHandler = (
  useCases: Dependencies = tradingBotUseCases,
  authenticate: typeof authenticatedUserId = authenticatedUserId,
) => withStrategyApiErrors(async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") return strategyMethodNotAllowed(res, ["PUT"]);
  const userId = await authenticate(req, res); if (!userId) return;
  const body = strategyBody(req.body);
  if (!body || typeof body.strategyVersionId !== "string" || !body.strategyVersionId)
    return strategyApiError(res, 400, "BAD_REQUEST", "strategyVersionId is required");
  const result = await useCases.activateStrategyVersion.execute(
    userId, String(req.query.id ?? ""), body.strategyVersionId,
  );
  if (result.ok) return res.status(200).json({ bot: toBotDto(result.bot) });
  const notFound = result.error === "Bot not found" || result.error === "Strategy version not found";
  return strategyApiError(res, notFound ? 404 : 409,
    notFound ? "NOT_FOUND" : "INVALID_TRANSITION", result.error);
});
export default createActivateStrategyVersionHandler();
