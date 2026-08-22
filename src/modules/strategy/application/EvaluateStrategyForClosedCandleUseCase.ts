import { randomUUID } from "node:crypto";
import type { BotRunRepository } from "@/src/modules/bot";
import { isMarketInterval, MARKET_INTERVAL_MILLISECONDS } from "@/src/modules/market";
import { evaluateStrategy, type StrategyEvaluation } from "../domain/StrategyEngine";
import { validateStrategyDefinition, type StrategyCondition } from "../domain/StrategyDefinition";
import type {
  ClosedCandleHistoryRepository,
  PersistedStrategyEvaluation,
  StrategyEvaluationRepository,
} from "../domain/StrategyEvaluationRepository";

type ConfigurationSnapshot = { pairSymbol: string; timeframe: string; feeRate?: string };
type StrategySnapshot = { schemaVersion: number; definition: unknown };

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function requiredCandles(condition: StrategyCondition): number {
  if ("all" in condition) return Math.max(...condition.all.map(requiredCandles));
  if ("any" in condition) return Math.max(...condition.any.map(requiredCandles));
  if ("candleSequence" in condition) return condition.candleSequence.count;
  if (condition.indicator === "POSITION_RETURN_PCT" || condition.indicator === "TRAILING_RETURN_PCT") return 1;
  if (condition.indicator === "EMA_CROSS_CONFIRMATION")
    return condition.period + condition.confirmationCandles;
  if (condition.indicator === "MARKET_REGIME") return 100;
  if (condition.indicator === "EMA_SLOPE") return condition.period + condition.lookbackCandles;
  return condition.indicator === "RSI"
    ? condition.period + (["CROSS_ABOVE", "CROSS_BELOW"].includes(condition.operator) ? 2 : 1)
    : condition.period;
}

function usesPositionReturn(condition: StrategyCondition): boolean {
  if ("all" in condition) return condition.all.some(usesPositionReturn);
  if ("any" in condition) return condition.any.some(usesPositionReturn);
  return "indicator" in condition &&
    (condition.indicator === "POSITION_RETURN_PCT" || condition.indicator === "TRAILING_RETURN_PCT");
}

function usesTrailingReturn(condition: StrategyCondition): boolean {
  if ("all" in condition) return condition.all.some(usesTrailingReturn);
  if ("any" in condition) return condition.any.some(usesTrailingReturn);
  return "indicator" in condition && condition.indicator === "TRAILING_RETURN_PCT";
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
    const validated = validateStrategyDefinition(strategy.definition, strategy.schemaVersion);
    if (!validated.ok)
      return { ok: false as const, error: "Strategy run snapshot is invalid", evaluation: null, reused: false };
    const exitFeeRate = typeof configuration.feeRate === "string" ? configuration.feeRate : "0";
    if (typeof configuration.pairSymbol !== "string" || !isMarketInterval(configuration.timeframe) ||
        candle.pairSymbol !== configuration.pairSymbol || candle.interval !== configuration.timeframe)
      return { ok: false as const, error: "Candle does not match the bot run snapshot", evaluation: null, reused: false };
    if (typeof configuration.feeRate !== "string" && usesPositionReturn(validated.definition.exit))
      return { ok: false as const, error: "Bot run fee snapshot is required for position-return exits",
        evaluation: null, reused: false };

    const positions = await this.evaluations.findActivePositions(botRunId);
    const oldestOpening = positions.reduce<number | null>((oldest, position) => {
      const timestamp = position.openedAt ? new Date(position.openedAt).getTime() : Number.NaN;
      return Number.isFinite(timestamp) ? Math.min(oldest ?? timestamp, timestamp) : oldest;
    }, null);
    // Trailing maxima are derived from immutable closed-candle history instead of persisted
    // state, so restarts and backtests use exactly the same calculation.
    // Ceiling is intentional: a fill just after an interval open still needs that
    // interval's eventual close included in every subsequent reconstruction.
    const lotHistory = !usesTrailingReturn(validated.definition.exit) || oldestOpening === null ? 1 :
      Math.max(1, Math.ceil((candle.openTime.getTime() - oldestOpening) /
        MARKET_INTERVAL_MILLISECONDS[configuration.timeframe]) + 1);
    const lookback = Math.max(requiredCandles(validated.definition.entry),
      requiredCandles(validated.definition.exit), lotHistory);
    const history = await this.candles.findClosedHistoryEndingAt(
      candle.pairSymbol, candle.interval, candle.openTime, lookback,
    );
    let engineResult: StrategyEvaluation;
    try {
      engineResult = evaluateStrategy({
        definition: validated.definition, candles: history, evaluatedCandle: candle,
        position: { hasOpenPositions: positions.length > 0, openPositionCount: positions.length,
          exitFeeRate, positions },
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
