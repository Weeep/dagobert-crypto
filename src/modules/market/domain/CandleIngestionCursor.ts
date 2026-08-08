import type { MarketInterval } from "./Candle";

export type CandleIngestionStatus = "IDLE" | "HEALTHY" | "ERROR";

export type CandleIngestionKey = {
  source: string;
  pairSymbol: string;
  interval: MarketInterval;
};

export type CandleIngestionCursor = CandleIngestionKey & {
  id: string;
  lastClosedOpenTime: Date | null;
  lastSuccessfulPollAt: Date | null;
  clockOffsetMs: bigint;
  status: CandleIngestionStatus;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CandleIngestionCheckpoint = CandleIngestionKey & {
  lastClosedOpenTime: Date;
  lastSuccessfulPollAt: Date;
  clockOffsetMs: bigint;
};

export interface CandleIngestionCursorRepository {
  find(key: CandleIngestionKey): Promise<CandleIngestionCursor | null>;
  recordError(key: CandleIngestionKey, message: string): Promise<void>;
}
