import type { NextApiRequest, NextApiResponse } from "next";
import { authenticatedUserId } from "@/src/modules/bot/infrastructure/http/botApiHelpers";
import { toStrategyDto } from "@/src/modules/strategy";
import { strategyApiError, strategyMethodNotAllowed, withStrategyApiErrors } from "@/src/modules/strategy/infrastructure/http/strategyApiHelpers";
import { tradingBotUseCases } from "@/src/shared/composition/serverUseCases";

type Dependencies = Pick<typeof tradingBotUseCases, "getStrategy">;
export const createStrategyDetailHandler = (
  useCases: Dependencies = tradingBotUseCases,
  authenticate: typeof authenticatedUserId = authenticatedUserId,
) => withStrategyApiErrors(async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return strategyMethodNotAllowed(res, ["GET"]);
  const userId = await authenticate(req, res); if (!userId) return;
  const strategy = await useCases.getStrategy.execute(userId, String(req.query.id ?? ""));
  return strategy
    ? res.status(200).json({ strategy: toStrategyDto(strategy) })
    : strategyApiError(res, 404, "NOT_FOUND", "Strategy not found");
});
export default createStrategyDetailHandler();
