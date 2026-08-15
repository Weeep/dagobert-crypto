import type { IndicatorSnapshot, StrategyDecision } from "@/src/modules/bot";
import type { Candle } from "@/src/modules/market";
import type { StrategyPositionLotContext } from "./StrategyEngine";

export interface ClosedCandleHistoryRepository {
  findById(id: string): Promise<Candle | null>;
  findClosedHistoryEndingAt(pairSymbol: string, interval: string, throughOpenTime: Date, limit: number): Promise<Candle[]>;
}

export type PersistedStrategyEvaluation = {
  decision: StrategyDecision;
  indicatorSnapshot: IndicatorSnapshot;
};

export interface StrategyEvaluationRepository {
  findByRunAndCandle(botRunId: string, candleId: string): Promise<PersistedStrategyEvaluation | null>;
  findActivePositions(botRunId: string): Promise<StrategyPositionLotContext[]>;
  saveIfAbsent(value: PersistedStrategyEvaluation): Promise<PersistedStrategyEvaluation>;
}
