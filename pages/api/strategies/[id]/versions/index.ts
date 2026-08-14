import type { NextApiRequest, NextApiResponse } from "next";
import { authenticatedUserId } from "@/src/modules/bot/infrastructure/http/botApiHelpers";
import { strategyApiError, strategyBody, strategyMethodNotAllowed,
  toStrategyVersionDto, withStrategyApiErrors } from "@/src/modules/strategy/infrastructure/http/strategyApiHelpers";
import { tradingBotUseCases } from "@/src/shared/composition/serverUseCases";

type Dependencies = Pick<typeof tradingBotUseCases, "addStrategyVersion">;
export const createStrategyVersionsHandler = (
  useCases: Dependencies = tradingBotUseCases,
  authenticate: typeof authenticatedUserId = authenticatedUserId,
) => withStrategyApiErrors(async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return strategyMethodNotAllowed(res, ["POST"]);
  const userId = await authenticate(req, res); if (!userId) return;
  const body = strategyBody(req.body);
  if (!body || body.definition === undefined)
    return strategyApiError(res, 400, "BAD_REQUEST", "definition is required");
  const result = await useCases.addStrategyVersion.execute(
    userId, String(req.query.id ?? ""), body.definition,
    body.schemaVersion === undefined ? 1 : Number(body.schemaVersion),
  );
  if (result.ok) return res.status(201).json({ version: toStrategyVersionDto(result.version) });
  return strategyApiError(res, result.error === "Strategy not found" ? 404 : 400,
    result.error === "Strategy not found" ? "NOT_FOUND" : "VALIDATION_ERROR", result.error);
});
export default createStrategyVersionsHandler();
