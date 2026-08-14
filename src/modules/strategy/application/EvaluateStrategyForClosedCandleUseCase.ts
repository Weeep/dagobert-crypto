import { randomUUID } from "node:crypto";
import type { BotRunRepository } from "@/src/modules/bot";
import { isMarketInterval } from "@/src/modules/market";
import { evaluateStrategy, type StrategyEvaluation } from "../domain/StrategyEngine";
import { validateStrategyDefinition, type StrategyCondition } from "../domain/StrategyDefinition";
import type {
  ClosedCandleHistoryRepository,
  PersistedStrategyEvaluation,
  StrategyEvaluationRepository,
} from "../domain/StrategyEvaluationRepository";

type ConfigurationSnapshot = { pairSymbol: string; timeframe: string };
type StrategySnapshot = { schemaVersion: number; definition: unknown };

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function requiredCandles(condition: StrategyCondition): number {
  if ("all" in condition) return Math.max(...condition.all.map(requiredCandles));
  if ("any" in condition) return Math.max(...condition.any.map(requiredCandles));
  if ("candleSequence" in condition) return condition.candleSequence.count;
  return condition.indicator === "RSI" ? condition.period + 1 : condition.period;
}

function jsonEvaluation(evaluation: StrategyEvaluation) {
  return { ...evaluation, evaluatedCandleOpenTime: evaluation.evaluatedCandleOpenTime.toISOString() };
}

export class EvaluateStrategyForClosedCandleUseCase {
  constructor(
    private readonly runs: BotRunRepository,
    private readonly candles: ClosedCandleHistoryRepository,
    private readonly evaluations: StrategyEvaluationRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(botRunId: string, candleId: string) {
    const existing = await this.evaluations.findByRunAndCandle(botRunId, candleId);
    if (existing) return { ok: true as const, error: "", evaluation: existing, reused: true };

    const run = await this.runs.findById(botRunId);
    if (!run) return { ok: false as const, error: "Bot run not found", evaluation: null, reused: false };
    if (run.status !== "RUNNING")
      return { ok: false as const, error: "Bot run is not running", evaluation: null, reused: false };
    const candle = await this.candles.findById(candleId);
    if (!candle || !candle.isClosed)
      return { ok: false as const, error: "Closed candle not found", evaluation: null, reused: false };

    if (!object(run.configurationSnapshot) || !object(run.strategySnapshot))
      return { ok: false as const, error: "Bot run snapshots are invalid", evaluation: null, reused: false };
    const configuration = run.configurationSnapshot as unknown as ConfigurationSnapshot;
    const strategy = run.strategySnapshot as unknown as StrategySnapshot;
    if (typeof configuration.pairSymbol !== "string" || !isMarketInterval(configuration.timeframe) ||
        candle.pairSymbol !== configuration.pairSymbol || candle.interval !== configuration.timeframe)
      return { ok: false as const, error: "Candle does not match the bot run snapshot", evaluation: null, reused: false };
    const validated = validateStrategyDefinition(strategy.definition, strategy.schemaVersion);
    if (!validated.ok)
      return { ok: false as const, error: "Strategy run snapshot is invalid", evaluation: null, reused: false };

    const lookback = Math.max(requiredCandles(validated.definition.entry), requiredCandles(validated.definition.exit));
    const history = await this.candles.findClosedHistoryEndingAt(
      candle.pairSymbol, candle.interval, candle.openTime, lookback,
    );
    const openPositionCount = await this.evaluations.countActivePositions(botRunId);
    let engineResult: StrategyEvaluation;
    try {
      engineResult = evaluateStrategy({
        definition: validated.definition, candles: history, evaluatedCandle: candle,
        position: { hasOpenPositions: openPositionCount > 0, openPositionCount },
      });
    } catch (error) {
      return { ok: false as const,
        error: error instanceof Error ? error.message : "Strategy evaluation failed",
        evaluation: null, reused: false };
    }

    const evaluatedAt = this.now();
    const persisted: PersistedStrategyEvaluation = {
      decision: {
        id: randomUUID(), botRunId, candleId, action: engineResult.action,
        reasonCode: engineResult.reasonCode, explanation: engineResult.explanation,
        inputs: { configurationSnapshot: run.configurationSnapshot,
          strategySnapshot: run.strategySnapshot, position: engineResult.position,
          candle: { id: candle.id, pairSymbol: candle.pairSymbol, interval: candle.interval,
            openTime: candle.openTime.toISOString(), closeTime: candle.closeTime.toISOString(),
            open: candle.open, high: candle.high, low: candle.low, close: candle.close } },
        output: jsonEvaluation(engineResult), evaluatedAt,
      },
      indicatorSnapshot: {
        id: randomUUID(), botRunId, candleId,
        values: { exit: engineResult.exit, entry: engineResult.entry }, calculatedAt: evaluatedAt,
      },
    };
    const saved = await this.evaluations.saveIfAbsent(persisted);
    return { ok: true as const, error: "", evaluation: saved, reused: saved.decision.id !== persisted.decision.id };
  }
}
