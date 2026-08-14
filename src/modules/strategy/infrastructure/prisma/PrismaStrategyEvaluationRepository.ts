import { Prisma, type PrismaClient } from "@prisma/client";
import type { IndicatorSnapshot, StrategyDecision } from "@/src/modules/bot";
import type { PersistedStrategyEvaluation, StrategyEvaluationRepository } from "../../domain/StrategyEvaluationRepository";

const json = (value: unknown) => value as Prisma.InputJsonValue;
const decision = (row: Awaited<ReturnType<PrismaClient["strategyDecision"]["findFirstOrThrow"]>>): StrategyDecision => ({
  id: row.id, botRunId: row.botRunId, candleId: row.candleId, action: row.action,
  reasonCode: row.reasonCode, explanation: row.explanation, inputs: row.inputs,
  output: row.output, evaluatedAt: row.evaluatedAt,
});
const snapshot = (row: Awaited<ReturnType<PrismaClient["indicatorSnapshot"]["findFirstOrThrow"]>>): IndicatorSnapshot => ({
  id: row.id, botRunId: row.botRunId, candleId: row.candleId,
  values: row.values, calculatedAt: row.calculatedAt,
});

export class PrismaStrategyEvaluationRepository implements StrategyEvaluationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByRunAndCandle(botRunId: string, candleId: string) {
    const [storedDecision, storedSnapshot] = await Promise.all([
      this.prisma.strategyDecision.findUnique({ where: { botRunId_candleId: { botRunId, candleId } } }),
      this.prisma.indicatorSnapshot.findUnique({ where: { botRunId_candleId: { botRunId, candleId } } }),
    ]);
    if (!storedDecision && !storedSnapshot) return null;
    if (!storedDecision || !storedSnapshot) throw new Error("strategy evaluation persistence is incomplete");
    return { decision: decision(storedDecision), indicatorSnapshot: snapshot(storedSnapshot) };
  }

  async countActivePositions(botRunId: string) {
    return this.prisma.position.count({ where: { botRunId, status: { in: ["OPENING", "OPEN", "CLOSING"] } } });
  }

  async saveIfAbsent(value: PersistedStrategyEvaluation) {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw(Prisma.sql`SELECT id FROM bot_runs
        WHERE id = ${value.decision.botRunId}::uuid FOR UPDATE`);
      const [existingDecision, existingSnapshot] = await Promise.all([
        transaction.strategyDecision.findUnique({ where: { botRunId_candleId: {
          botRunId: value.decision.botRunId, candleId: value.decision.candleId } } }),
        transaction.indicatorSnapshot.findUnique({ where: { botRunId_candleId: {
          botRunId: value.decision.botRunId, candleId: value.decision.candleId } } }),
      ]);
      if (existingDecision && existingSnapshot)
        return { decision: decision(existingDecision), indicatorSnapshot: snapshot(existingSnapshot) };
      if (existingDecision || existingSnapshot) throw new Error("strategy evaluation persistence is incomplete");
      const storedDecision = await transaction.strategyDecision.create({ data: {
        id: value.decision.id, botRunId: value.decision.botRunId, candleId: value.decision.candleId,
        action: value.decision.action, reasonCode: value.decision.reasonCode,
        explanation: value.decision.explanation, inputs: json(value.decision.inputs),
        output: json(value.decision.output), evaluatedAt: value.decision.evaluatedAt,
      } });
      const storedSnapshot = await transaction.indicatorSnapshot.create({ data: {
        id: value.indicatorSnapshot.id, botRunId: value.indicatorSnapshot.botRunId,
        candleId: value.indicatorSnapshot.candleId, values: json(value.indicatorSnapshot.values),
        calculatedAt: value.indicatorSnapshot.calculatedAt,
      } });
      return { decision: decision(storedDecision), indicatorSnapshot: snapshot(storedSnapshot) };
    });
  }
}
