import { Prisma, type PrismaClient } from "@prisma/client";
import type { BacktestRunPersistenceRepository, HistoricalBacktestResult } from "@/src/modules/bot";
import { buildBacktestPersistencePlan } from "../../application/BacktestRunPersistencePlan";

const json = (value: unknown) => value as Prisma.InputJsonValue;

export class PrismaBacktestRunPersistenceRepository implements BacktestRunPersistenceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async persistCompleted(runId: string, result: HistoricalBacktestResult) {
    const plan = buildBacktestPersistencePlan(runId, result);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM bot_runs WHERE id = ${runId}::uuid FOR UPDATE`;
      const run = await tx.botRun.findUnique({ where: { id: runId } });
      if (!run) throw new Error("backtest run was not found");
      if (run.mode !== "BACKTEST") throw new Error("run is not a backtest");
      if (run.status === "COMPLETED") return { reused: true };
      if (run.status !== "RUNNING") throw new Error("backtest run is not running");
      const [positions, orders, fills, decisions, indicators, events, snapshots, nonAllocationLedger] = await Promise.all([
        tx.position.count({ where: { botRunId: runId } }), tx.botOrder.count({ where: { botRunId: runId } }),
        tx.fill.count({ where: { botOrder: { botRunId: runId } } }),
        tx.strategyDecision.count({ where: { botRunId: runId } }),
        tx.indicatorSnapshot.count({ where: { botRunId: runId } }), tx.botEvent.count({ where: { botRunId: runId } }),
        tx.portfolioSnapshot.count({ where: { botRunId: runId } }),
        tx.botLedgerEntry.count({ where: { botRunId: runId, type: { not: "ALLOCATION" } } }),
      ]);
      if ([positions, orders, fills, decisions, indicators, events, snapshots, nonAllocationLedger]
        .some((count) => count !== 0))
        throw new Error("backtest run already contains incomplete trading records");
      const allocations = await tx.botLedgerEntry.findMany({ where: { botRunId: runId, type: "ALLOCATION" } });
      if (allocations.length !== 1 || allocations[0].amount.toString() !== result.portfolio.initialCash ||
          allocations[0].balanceAfter.toString() !== result.portfolio.initialCash)
        throw new Error("backtest allocation does not match runner initial cash");

      if (plan.positions.length) await tx.position.createMany({ data: plan.positions });
      if (plan.orders.length) await tx.botOrder.createMany({ data: plan.orders.map((order) => ({
        ...order, exchangeOrderId: null, status: "FILLED" as const,
      })) });
      if (plan.fills.length) await tx.fill.createMany({ data: plan.fills });
      if (plan.ledgerEntries.length) await tx.botLedgerEntry.createMany({ data: plan.ledgerEntries });
      if (plan.decisions.length) await tx.strategyDecision.createMany({ data: plan.decisions.map((decision) => ({
        ...decision, inputs: json(decision.inputs), output: json(decision.output),
      })) });
      if (plan.indicatorSnapshots.length) await tx.indicatorSnapshot.createMany({
        data: plan.indicatorSnapshots.map((snapshot) => ({ ...snapshot, values: json(snapshot.values) })),
      });
      if (plan.events.length) await tx.botEvent.createMany({
        data: plan.events.map((event) => ({ ...event, payload: json(event.payload) })),
      });
      if (plan.portfolioSnapshots.length) await tx.portfolioSnapshot.createMany({ data: plan.portfolioSnapshots });
      await tx.botRun.update({ where: { id: runId }, data: { status: "COMPLETED", endedAt: plan.endedAt,
        errorMessage: null } });
      await tx.bot.updateMany({ where: { id: run.botId, status: "RUNNING" }, data: { status: "PAUSED" } });
      return { reused: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
}
