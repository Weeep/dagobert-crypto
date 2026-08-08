import type { Candle } from "./Candle";
export interface CandleRepository {
  findById(id: string): Promise<Candle | null>;
  findRange(pairSymbol: string, interval: string, from: Date, to: Date): Promise<Candle[]>;
  saveMany(candles: Candle[]): Promise<void>;
}
