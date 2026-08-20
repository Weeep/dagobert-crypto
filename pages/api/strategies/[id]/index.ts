import type { NextApiRequest, NextApiResponse } from "next";
import { authenticatedUserId } from "@/src/modules/bot/infrastructure/http/botApiHelpers";
import { toStrategyDto } from "@/src/modules/strategy";
import { strategyApiError, strategyBody, strategyMethodNotAllowed, withStrategyApiErrors } from "@/src/modules/strategy/infrastructure/http/strategyApiHelpers";
import { tradingBotUseCases } from "@/src/shared/composition/serverUseCases";
import { prisma } from "@/src/shared/infrastructure/prisma/prisma";

type Dependencies = Pick<typeof tradingBotUseCases, "getStrategy">;
export const createStrategyDetailHandler = (
  useCases: Dependencies = tradingBotUseCases,
  authenticate: typeof authenticatedUserId = authenticatedUserId,
) => withStrategyApiErrors(async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!["GET", "PATCH", "DELETE"].includes(req.method ?? "")) return strategyMethodNotAllowed(res, ["GET", "PATCH", "DELETE"]);
  const userId = await authenticate(req, res); if (!userId) return;
  const id = String(req.query.id ?? "");
  if (req.method === "PATCH") {
    const existing = await prisma.strategy.findFirst({ where: { id, userId } });
    if (!existing) return strategyApiError(res, 404, "NOT_FOUND", "Strategy not found");
    const body = strategyBody(req.body);
    if (!body) return strategyApiError(res, 400, "BAD_REQUEST", "JSON object required");
    const strategy = await prisma.strategy.update({ where: { id }, data: {
      ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
      ...(body.description !== undefined ? { description: String(body.description).trim() } : {}),
      ...(body.archived !== undefined ? { archivedAt: body.archived ? new Date() : null } : {}),
    }, include: { versions: { orderBy: { version: "asc" } } } });
    return res.status(200).json({ strategy: toStrategyDto({ ...strategy,
      versions: strategy.versions.map((version) => ({ ...version, definition: version.definition as never })) }) });
  }
  if (req.method === "DELETE") {
    const existing = await prisma.strategy.findFirst({ where: { id, userId }, select: { id: true } });
    if (!existing) return strategyApiError(res, 404, "NOT_FOUND", "Strategy not found");
    await prisma.$transaction(async (tx) => {
      await tx.bot.deleteMany({ where: { userId, strategyVersion: { strategyId: id } } });
      await tx.strategy.delete({ where: { id } });
    });
    return res.status(204).end();
  }
  const strategy = await useCases.getStrategy.execute(userId, id);
  return strategy
    ? res.status(200).json({ strategy: toStrategyDto(strategy) })
    : strategyApiError(res, 404, "NOT_FOUND", "Strategy not found");
});
export default createStrategyDetailHandler();
