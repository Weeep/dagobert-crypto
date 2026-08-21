import type { NextApiRequest, NextApiResponse } from "next";
import { authenticatedUserId } from "@/src/modules/bot/infrastructure/http/botApiHelpers";
import { toStrategyDto } from "@/src/modules/strategy";
import { strategyApiError, strategyBody, strategyMethodNotAllowed, withStrategyApiErrors } from "@/src/modules/strategy/infrastructure/http/strategyApiHelpers";
import { tradingBotUseCases } from "@/src/shared/composition/serverUseCases";
import { prisma } from "@/src/shared/infrastructure/prisma/prisma";
import { Prisma } from "@prisma/client";

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
    const name = body.name === undefined ? undefined : String(body.name).trim();
    if (name === "") return strategyApiError(res, 400, "VALIDATION_ERROR", "Strategy name is required");
    if (name && name !== existing.name && await prisma.strategy.findFirst({
      where: { userId, name, id: { not: id } }, select: { id: true },
    })) return strategyApiError(res, 409, "STRATEGY_NAME_CONFLICT", `Strategy already exists: ${name}`);
    let strategy;
    try { strategy = await prisma.strategy.update({ where: { id }, data: {
      ...(name !== undefined ? { name } : {}),
      ...(body.description !== undefined ? { description: String(body.description).trim() } : {}),
      ...(body.archived !== undefined ? { archivedAt: body.archived ? new Date() : null } : {}),
    }, include: { versions: { orderBy: { version: "asc" } } } }); }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        return strategyApiError(res, 409, "STRATEGY_NAME_CONFLICT", `Strategy already exists: ${name}`);
      throw error;
    }
    return res.status(200).json({ strategy: toStrategyDto({ ...strategy,
      versions: strategy.versions.map((version) => ({ ...version, definition: version.definition as never })) }) });
  }
  if (req.method === "DELETE") {
    const existing = await prisma.strategy.findFirst({ where: { id, userId }, select: { id: true } });
    if (!existing) return strategyApiError(res, 404, "NOT_FOUND", "Strategy not found");
    const deleted = await prisma.$transaction(async (tx) => {
      const runningBot = await tx.bot.findFirst({ where: {
        userId, status: "RUNNING", strategyVersion: { strategyId: id },
      }, select: { id: true } });
      if (runningBot) return false;
      await tx.bot.deleteMany({ where: { userId, strategyVersion: { strategyId: id } } });
      await tx.strategy.delete({ where: { id } });
      return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (!deleted) return strategyApiError(res, 409, "STRATEGY_IN_USE",
      "Stop every running bot that uses this strategy before deleting it");
    return res.status(204).end();
  }
  const strategy = await useCases.getStrategy.execute(userId, id);
  return strategy
    ? res.status(200).json({ strategy: toStrategyDto(strategy) })
    : strategyApiError(res, 404, "NOT_FOUND", "Strategy not found");
});
export default createStrategyDetailHandler();
