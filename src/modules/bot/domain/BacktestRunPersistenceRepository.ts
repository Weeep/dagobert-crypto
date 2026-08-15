import type { HistoricalBacktestResult } from "./HistoricalBacktestRunner";

export type PersistBacktestRunResult = { reused: boolean };

export interface BacktestRunPersistenceRepository {
  persistCompleted(runId: string, result: HistoricalBacktestResult,
    onProgress?: (percent: number, operation: string) => void): Promise<PersistBacktestRunResult>;
  markFailed(runId: string, message: string): Promise<void>;
}
