import type { HistoricalBacktestResult } from "./HistoricalBacktestRunner";

export type PersistBacktestRunResult = { reused: boolean };

export interface BacktestRunPersistenceRepository {
  persistCompleted(runId: string, result: HistoricalBacktestResult): Promise<PersistBacktestRunResult>;
}
