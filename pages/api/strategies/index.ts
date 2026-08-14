import type { NextApiRequest, NextApiResponse } from "next";
import { authenticatedUserId } from "@/src/modules/bot/infrastructure/http/botApiHelpers";
import { toStrategyDto } from "@/src/modules/strategy";
import { strategyApiError, strategyBody, strategyMethodNotAllowed, withStrategyApiErrors } from "@/src/modules/strategy/infrastructure/http/strategyApiHelpers";
import { tradingBotUseCases } from "@/src/shared/composition/serverUseCases";

type Dependencies = Pick<typeof tradingBotUseCases, "listStrategies" | "createStrategy">;
export const createStrategiesHandler = (
  useCases: Dependencies = tradingBotUseCases,
  authenticate: typeof authenticatedUserId = authenticatedUserId,
) => withStrategyApiErrors(async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await authenticate(req, res); if (!userId) return;
  if (req.method === "GET")
    return res.status(200).json({ strategies: (await useCases.listStrategies.execute(userId)).map(toStrategyDto) });
  if (req.method !== "POST") return strategyMethodNotAllowed(res, ["GET", "POST"]);
  const body = strategyBody(req.body);
  if (!body) return strategyApiError(res, 400, "BAD_REQUEST", "JSON object required");
  const result = await useCases.createStrategy.execute({
    userId, name: String(body.name ?? ""), description: body.description === undefined ? undefined : String(body.description),
    definition: body.definition, schemaVersion: body.schemaVersion === undefined ? undefined : Number(body.schemaVersion),
  });
  return result.ok
    ? res.status(201).json({ strategy: toStrategyDto(result.strategy) })
    : strategyApiError(res, 400, "VALIDATION_ERROR", result.error);
});
export default createStrategiesHandler();
