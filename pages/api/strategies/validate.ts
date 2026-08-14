import type { NextApiRequest, NextApiResponse } from "next";
import { authenticatedUserId } from "@/src/modules/bot/infrastructure/http/botApiHelpers";
import { strategyApiError, strategyBody, strategyMethodNotAllowed, withStrategyApiErrors } from "@/src/modules/strategy/infrastructure/http/strategyApiHelpers";
import { tradingBotUseCases } from "@/src/shared/composition/serverUseCases";

type Dependencies = Pick<typeof tradingBotUseCases, "validateStrategyDefinition">;
export const createValidateStrategyHandler = (
  useCases: Dependencies = tradingBotUseCases,
  authenticate: typeof authenticatedUserId = authenticatedUserId,
) => withStrategyApiErrors(async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return strategyMethodNotAllowed(res, ["POST"]);
  if (!await authenticate(req, res)) return;
  const body = strategyBody(req.body);
  if (!body || body.definition === undefined)
    return strategyApiError(res, 400, "BAD_REQUEST", "definition is required");
  const schemaVersion = body.schemaVersion === undefined ? 1 : Number(body.schemaVersion);
  const result = useCases.validateStrategyDefinition.execute(body.definition, schemaVersion);
  return result.ok
    ? res.status(200).json({ valid: true, definition: result.definition, issues: [] })
    : res.status(400).json({ valid: false, definition: null, issues: result.issues });
});
export default createValidateStrategyHandler();
