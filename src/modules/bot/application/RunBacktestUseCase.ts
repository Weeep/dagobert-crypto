import { MARKET_INTERVAL_MILLISECONDS, type CandleRepository } from "@/src/modules/market";
import { requiredCandles, validateStrategyDefinition, type ClosedCandleHistoryRepository,
  type StrategyRepository } from "@/src/modules/strategy";
import type { BotRepository } from "../domain/BotRepository";
import type { BacktestRunPersistenceRepository } from "../domain/BacktestRunPersistenceRepository";
import { calculateBacktestMetrics } from "../domain/BacktestMetrics";
import { runHistoricalBacktestAsync } from "../domain/HistoricalBacktestRunner";
import type { StartBotUseCase } from "./StartBotUseCase";
import type { HistoricalBacktestProgress } from "../domain/HistoricalBacktestRunner";

export class RunBacktestUseCase {
  constructor(private readonly bots: BotRepository, private readonly strategies: StrategyRepository,
    private readonly candles: CandleRepository & ClosedCandleHistoryRepository,
    private readonly start: StartBotUseCase, private readonly persistence: BacktestRunPersistenceRepository) {}

  async execute(userId: string, botId: string, range: { from: Date; to: Date },
    onProgress?: (progress: HistoricalBacktestProgress) => void) {
    const bot = await this.bots.findById(botId);
    if (!bot || bot.userId !== userId) return { ok: false as const, error: "Bot not found", status: 404, result: null };
    if (bot.mode !== "BACKTEST") return { ok: false as const, error: "Bot is not in backtest mode", status: 409, result: null };
    if (!this.validDate(range.from) || !this.validDate(range.to) || range.from >= range.to)
      return { ok: false as const, error: "A valid ascending backtest range is required", status: 400, result: null };
    const version = await this.strategies.findVersionById(bot.strategyVersionId);
    if (!version) return { ok: false as const, error: "Strategy version not found", status: 409, result: null };
    const validated = validateStrategyDefinition(version.definition, version.schemaVersion);
    if (!validated.ok) return { ok: false as const, error: "Strategy version is invalid", status: 409, result: null };
    const lookback = Math.max(requiredCandles(validated.definition.entry), requiredCandles(validated.definition.exit));
    const interval = MARKET_INTERVAL_MILLISECONDS[bot.timeframe];
    const totalSlots = Math.floor((range.to.getTime() - range.from.getTime()) / interval) + 1;
    const rangeCandles = [] as Awaited<ReturnType<CandleRepository["findRange"]>>;
    const chunkSlots = 500;
    onProgress?.({ phase: "LOADING", processedCandles: 0, totalCandles: totalSlots,
      loadedCandles: 0, percent: 0, decisions: { HOLD: 0, BUY: 0, SELL: 0 } });
    for (let offset = 0; offset < totalSlots; offset += chunkSlots) {
      const endOffset = Math.min(offset + chunkSlots - 1, totalSlots - 1);
      const chunk = await this.candles.findRange(bot.pairSymbol, bot.timeframe,
        new Date(range.from.getTime() + offset * interval),
        new Date(Math.min(range.to.getTime(), range.from.getTime() + endOffset * interval)));
      rangeCandles.push(...chunk);
      const processed = endOffset + 1;
      onProgress?.({ phase: "LOADING", processedCandles: processed, totalCandles: totalSlots,
        loadedCandles: rangeCandles.length, percent: Math.round((processed / totalSlots) * 100),
        decisions: { HOLD: 0, BUY: 0, SELL: 0 } });
    }
    const warmup = await this.candles.findClosedHistoryEndingAt(bot.pairSymbol, bot.timeframe, range.from, lookback);
    if (rangeCandles.length === 0)
      return { ok: false as const, error: "No closed candles exist in the selected range", status: 422, result: null };
    const evaluated = rangeCandles.filter((candle) => candle.openTime >= range.from && candle.openTime <= range.to);
    if (evaluated.some((candle, index) => index > 0 &&
      candle.openTime.getTime() !== evaluated[index - 1].openTime.getTime() + interval))
      return { ok: false as const, error: "Selected candle range contains a gap", status: 422, result: null };
    const history = Array.from(new Map([...warmup, ...rangeCandles].map((candle) => [candle.id, candle])).values())
      .sort((left, right) => left.openTime.getTime() - right.openTime.getTime());
    const execution = { assignedBudget: bot.assignedBudget, amountPerPosition: bot.amountPerPosition,
      feeRate: bot.feeRate, slippageRate: bot.slippageRate };
    const runner = await runHistoricalBacktestAsync({ definition: validated.definition, candles: history,
      backtestFrom: range.from, backtestTo: range.to, execution, onProgress });
    const decisionCounts = runner.decisions.reduce((counts, decision) => ({ ...counts,
      [decision.evaluation.action]: counts[decision.evaluation.action] + 1 }), { HOLD: 0, BUY: 0, SELL: 0 });
    const metrics = calculateBacktestMetrics(runner, evaluated, execution);
    const started = await this.start.execute(botId, range);
    if (!started.ok) {
      console.error("[backtest] run could not be started", { userId, botId, botStatus: bot.status,
        botMode: bot.mode, reason: started.error });
      return { ok: false as const, error: started.error, status: 409, result: null };
    }
    try { await this.persistence.persistCompleted(started.run.id, runner, (percent, currentOperation) =>
      onProgress?.({ phase: "SAVING", processedCandles: evaluated.length, totalCandles: evaluated.length,
        percent, currentOperation, decisions: decisionCounts })); }
    catch (error) {
      console.error("[backtest] persistence failed", backtestErrorLog(error, { userId, botId, runId: started.run.id }));
      await this.persistence.markFailed(started.run.id, backtestFailureMessage(error)).catch((markError) =>
        console.error("[backtest] failed to record persistence error", backtestErrorLog(markError, { botId, runId: started.run.id })));
      throw error;
    }
    return { ok: true as const, error: "", status: 200,
      result: { runId: started.run.id, metrics,
        decisions: runner.decisions, fills: runner.fills, events: runner.events,
        snapshots: runner.snapshots, positions: runner.portfolio.closedPositions,
        openPositions: runner.portfolio.openPositions } };
  }

  private validDate(value: Date) { return value instanceof Date && Number.isFinite(value.getTime()); }
}

export function backtestFailureMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code === "P2022") return "The database schema is out of date. Apply the pending migrations and retry.";
  if (code === "P2002") return "A backtest result already exists for one of the generated records. Retry the backtest.";
  if (code === "P2003") return "A related market-data record is missing. Check candle data and retry.";
  if (code === "P2024") return "The database was too busy to complete the backtest. Please retry shortly.";
  if (code === "P2028") return "Saving the backtest exceeded the database transaction time limit. Retry the run; if it repeats, reduce the date range and contact support with the run ID.";
  if (error instanceof Error && ["backtest run was not found", "run is not a backtest",
    "backtest run is not running", "backtest run already contains incomplete trading records",
    "backtest allocation does not match runner initial cash"].includes(error.message)) return error.message;
  return "The backtest was calculated, but its results could not be saved. Please retry or contact support with the run ID.";
}

export function backtestErrorLog(error: unknown, context: Record<string, string>) {
  return { ...context, error: error instanceof Error ? { name: error.name, message: error.message,
    stack: error.stack, ...(("code" in error) ? { code: String(error.code) } : {}) } : { value: String(error) } };
}
