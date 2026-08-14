import type { NextApiRequest, NextApiResponse } from "next";
import { authenticatedUserId } from "@/src/modules/bot/infrastructure/http/botApiHelpers";
import { strategyApiError, strategyMethodNotAllowed,
  toStrategyVersionDto, withStrategyApiErrors } from "@/src/modules/strategy/infrastructure/http/strategyApiHelpers";
import { tradingBotUseCases } from "@/src/shared/composition/serverUseCases";

type Dependencies = Pick<typeof tradingBotUseCases, "getStrategyVersion">;
export const createStrategyVersionDetailHandler = (
  useCases: Dependencies = tradingBotUseCases,
  authenticate: typeof authenticatedUserId = authenticatedUserId,
) => withStrategyApiErrors(async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return strategyMethodNotAllowed(res, ["GET"]);
  const userId = await authenticate(req, res); if (!userId) return;
  const version = await useCases.getStrategyVersion.execute(
    userId, String(req.query.id ?? ""), Number(req.query.version),
  );
  return version
    ? res.status(200).json({ version: toStrategyVersionDto(version) })
    : strategyApiError(res, 404, "NOT_FOUND", "Strategy version not found");
});
export default createStrategyVersionDetailHandler();
