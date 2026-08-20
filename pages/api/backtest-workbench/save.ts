import type { NextApiRequest, NextApiResponse } from "next";
import { authenticatedUserId, bodyRecord } from "@/src/modules/bot/infrastructure/http/botApiHelpers";
import { getStoredWorkbench } from "@/src/modules/bot/application/BacktestWorkbench";
import { tradingBotUseCases, postgresRepositories } from "@/src/shared/composition/serverUseCases";

const uniqueName = (base: string, suffix: string) => `${base} · ${suffix} · ${new Date().toISOString().replace(/[:.]/g, "-")}`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: { message: "Method not allowed" } }); }
  const userId = await authenticatedUserId(req, res); if (!userId) return;
  const body = bodyRecord(req.body); const workbench = typeof body?.workbenchId === "string"
    ? getStoredWorkbench(body.workbenchId, userId) : null;
  if (!body || !workbench) return res.status(410).json({ error: { message: "This temporary backtest expired; run it again" } });
  const resultId = typeof body.resultId === "string" ? body.resultId : "";
  const item = resultId ? workbench.results.get(resultId) : undefined;
  const kind = body.kind;
  if (!(["strategy", "bot", "run"] as unknown[]).includes(kind) || (kind !== "strategy" && !item))
    return res.status(400).json({ error: { message: "A valid save kind and result are required" } });
  try {
    let strategyId = workbench.strategyId; let strategyVersionId = "";
    if (strategyId) {
      const existing = await postgresRepositories.strategyRepository.findById(strategyId);
      strategyVersionId = existing?.versions[0]?.id ?? "";
    }
    if (!strategyId || !strategyVersionId) {
      const createdStrategy = await tradingBotUseCases.createStrategy.execute({ userId,
        name: uniqueName(workbench.definition.name, "workbench"), definition: workbench.definition });
      if (!createdStrategy.ok) throw new Error(createdStrategy.error);
      strategyId = createdStrategy.strategy.id; strategyVersionId = createdStrategy.strategy.versions[0].id;
      workbench.strategyId = strategyId;
    }
    const response: Record<string, string> = { strategyId };
    if (kind === "strategy") return res.status(201).json(response);
    const summary = item!.summary;
    let botId = workbench.botIds.get(resultId);
    if (!botId) {
      const createdBot = await tradingBotUseCases.createBot.execute({ userId,
        name: uniqueName(`${summary.pairSymbol} ${summary.timeframe}`, "backtest"), pairSymbol: summary.pairSymbol,
        timeframe: summary.timeframe, assignedBudget: "55", amountPerPosition: "10", feeRate: "0.001",
        slippageRate: "0.001", strategyVersionId });
      if (!createdBot.ok) throw new Error(createdBot.error);
      botId = createdBot.bot.id; workbench.botIds.set(resultId, botId);
    }
    response.botId = botId;
    if (kind === "bot") return res.status(201).json(response);
    const started = await tradingBotUseCases.startBot.execute(botId, { from: workbench.from, to: workbench.to });
    if (!started.ok) throw new Error(started.error);
    const detailed = body.detail === "detailed";
    const runner = detailed ? item!.runner : { ...item!.runner,
      decisions: item!.runner.decisions.filter((decision) => decision.evaluation.action !== "HOLD"),
      events: item!.runner.events.filter((event) => event.eventType !== "DECISION_MADE" ||
        item!.runner.decisions.some((decision) => decision.candleId === event.candleId && decision.evaluation.action !== "HOLD")),
      snapshots: [item!.runner.snapshots.at(-1)!],
    };
    try {
      await postgresRepositories.backtestRunPersistenceRepository.persistCompleted(started.run.id, runner);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Backtest persistence failed";
      await postgresRepositories.backtestRunPersistenceRepository.markFailed(started.run.id, message)
        .catch(() => undefined);
      throw error;
    }
    response.runId = started.run.id;
    return res.status(201).json(response);
  } catch (error) { return res.status(422).json({ error: { message: error instanceof Error ? error.message : "Save failed" } }); }
}
