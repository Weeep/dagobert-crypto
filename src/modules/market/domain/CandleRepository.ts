import type { Candle } from "./Candle";
import type { CandleIngestionCheckpoint } from "./CandleIngestionCursor";
export interface CandleRepository {
  findById(id: string): Promise<Candle | null>;
  findRange(pairSymbol: string, interval: string, from: Date, to: Date): Promise<Candle[]>;
  saveMany(candles: Candle[], checkpoint?: CandleIngestionCheckpoint): Promise<void>;
}
