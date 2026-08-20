import { randomUUID } from "node:crypto";
import { calculateBacktestMetrics, runHistoricalBacktestAsync,
  type BacktestMetrics, type HistoricalBacktestResult } from "@/src/modules/bot";
import type { CandleRepository } from "@/src/modules/market";
import { MARKET_INTERVAL_MILLISECONDS } from "@/src/modules/market";
import { requiredCandles, validateStrategyDefinition, type ClosedCandleHistoryRepository,
  type ConditionEvaluation, type StrategyCondition, type StrategyDefinitionV1 } from "@/src/modules/strategy";
import type { MarketInterval } from "@/src/shared/domain/MarketInterval";

export const WORKBENCH_EXECUTION = { assignedBudget: "55", amountPerPosition: "10",
  feeRate: "0.001", slippageRate: "0.001" } as const;

export type WorkbenchNearMiss = { condition: string; count: number };
export type WorkbenchResult = { id: string; rowId: string; pairSymbol: string; timeframe: MarketInterval;
  metrics: BacktestMetrics; decisions: { BUY: number; SELL: number; HOLD: number }; buyCount: number;
  sellCount: number; openBuyCount: number; nearMisses: WorkbenchNearMiss[]; candleCount: number };
export type StoredWorkbench = { id: string; userId: string; definition: StrategyDefinitionV1; from: Date; to: Date;
  expiresAt: number; strategyId?: string; botIds: Map<string, string>;
  results: Map<string, { summary: WorkbenchResult; runner: HistoricalBacktestResult }> };

const registry = new Map<string, StoredWorkbench>();
const removeAtExpiry = (stored: StoredWorkbench) => {
  const timeout = setTimeout(() => {
    if (registry.get(stored.id) === stored) registry.delete(stored.id);
  }, Math.max(0, stored.expiresAt - Date.now()));
  timeout.unref?.();
};
export const storeWorkbench = (stored: StoredWorkbench) => {
  registry.set(stored.id, stored);
  removeAtExpiry(stored);
};
export const getStoredWorkbench = (id: string, userId: string) => {
  const stored = registry.get(id);
  if (!stored || stored.userId !== userId || stored.expiresAt < Date.now()) { registry.delete(id); return null; }
  return stored;
};

const conditionLabel = (condition: StrategyCondition, evaluation: ConditionEvaluation): string => {
  if ("all" in condition || "any" in condition) {
    const type = "all" in condition ? "ALL" : "ANY";
    const children = "all" in condition ? condition.all : condition.any;
    return `${type}(${children.map((child, index) =>
      conditionLabel(child, evaluation.children[index] ?? evaluation)).join(", ")})`;
  }
  if ("indicator" in condition) {
    if (condition.indicator === "MARKET_REGIME") return `MARKET_REGIME ${condition.value}`;
    if (condition.indicator === "EMA_CROSS_CONFIRMATION")
      return `EMA(${condition.period}) cross ${condition.direction} × ${condition.confirmationCandles}`;
    if (condition.indicator === "EMA_SLOPE")
      return `EMA(${condition.period}) slope ${condition.operator} ${condition.value}%`;
    if (condition.indicator === "EMA_DEVIATION_PCT")
      return `EMA(${condition.period}) deviation ${condition.operator} ${condition.value}%`;
    if (condition.indicator === "EMA_DISTANCE") return `EMA(${condition.period}) ${condition.position}`;
    if (condition.indicator === "POSITION_RETURN_PCT") return `POSITION_RETURN ${condition.operator} ${condition.value}%`;
    return `${condition.indicator}(${condition.period}) ${condition.operator} ${condition.value}`;
  }
  return evaluation.type;
};

export function collectNearMisses(definition: StrategyDefinitionV1, runner: HistoricalBacktestResult) {
  const grouped = new Map<string, number>();
  if (!("all" in definition.entry)) return [];
  for (const decision of runner.decisions) {
    const entry = decision.evaluation.entry;
    if (entry.matched || entry.children.length !== definition.entry.all.length) continue;
    const failed = entry.children.map((child, index) => ({ child, index })).filter(({ child }) => !child.matched);
    if (failed.length !== 1 || failed[0].child.reasonCode === "INSUFFICIENT_HISTORY") continue;
    const label = conditionLabel(definition.entry.all[failed[0].index], failed[0].child);
    grouped.set(label, (grouped.get(label) ?? 0) + 1);
  }
  return Array.from(grouped.entries()).map(([condition, count]) => ({ condition, count }))
    .sort((a, b) => b.count - a.count);
}

export async function runWorkbench(input: { userId: string; definition: unknown; from: Date; to: Date;
  rows: { id: string; pairSymbol: string; timeframe: MarketInterval }[] },
  candles: CandleRepository & ClosedCandleHistoryRepository) {
  const validated = validateStrategyDefinition(input.definition);
  if (!validated.ok) throw new Error(`${validated.issues[0].path}: ${validated.issues[0].message}`);
  const lookback = Math.max(requiredCandles(validated.definition.entry), requiredCandles(validated.definition.exit));
  const resultRows = await Promise.all(input.rows.map(async (row) => {
    const interval = MARKET_INTERVAL_MILLISECONDS[row.timeframe];
    const expectedFirst = new Date(Math.ceil(input.from.getTime() / interval) * interval);
    const expectedLast = new Date(Math.floor(input.to.getTime() / interval) * interval);
    const range = await candles.findRange(row.pairSymbol, row.timeframe, expectedFirst, expectedLast);
    const expectedCount = Math.floor((expectedLast.getTime() - expectedFirst.getTime()) / interval) + 1;
    if (range.length !== expectedCount || range.some((candle, index) =>
      candle.openTime.getTime() !== expectedFirst.getTime() + index * interval))
      throw new Error(`${row.pairSymbol} ${row.timeframe}: candle coverage is incomplete or contains a gap`);
    const warmup = await candles.findClosedHistoryEndingAt(row.pairSymbol, row.timeframe,
      new Date(expectedFirst.getTime() - interval), lookback);
    const history = [...warmup, ...range];
    const runner = await runHistoricalBacktestAsync({ definition: validated.definition, candles: history,
      backtestFrom: expectedFirst, backtestTo: expectedLast, execution: WORKBENCH_EXECUTION, includeFullTimeline: true });
    const summary: WorkbenchResult = { id: randomUUID(), rowId: row.id, pairSymbol: row.pairSymbol,
      timeframe: row.timeframe, metrics: calculateBacktestMetrics(runner, range, WORKBENCH_EXECUTION),
      decisions: runner.actionCounts, buyCount: runner.fills.filter((fill) => fill.side === "BUY").length,
      sellCount: runner.fills.filter((fill) => fill.side === "SELL").length,
      openBuyCount: runner.portfolio.openPositions.length, nearMisses: collectNearMisses(validated.definition, runner),
      candleCount: range.length };
    return { summary, runner };
  }));
  const stored: StoredWorkbench = { id: randomUUID(), userId: input.userId, definition: validated.definition,
    from: input.from, to: input.to, expiresAt: Date.now() + 60 * 60 * 1000,
    botIds: new Map(),
    results: new Map(resultRows.map((item) => [item.summary.id, item])) };
  storeWorkbench(stored);
  return { workbenchId: stored.id, expiresAt: new Date(stored.expiresAt).toISOString(),
    results: resultRows.map(({ summary }) => summary) };
}
