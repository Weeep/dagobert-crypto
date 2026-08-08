import type { Candle } from "../domain/Candle";
import type { CandleRepository } from "../domain/CandleRepository";
export class SaveCandlesUseCase {
  constructor(private readonly repository: CandleRepository) {}
  async execute(candles: Candle[]) {
    for (const candle of candles) {
      if (!/^[A-Z0-9]+USDC$/.test(candle.pairSymbol) || candle.openTime >= candle.closeTime)
        return { ok: false as const, error: "Invalid candle identity or time range", saved: 0 };
      if (Number(candle.low) > Math.min(Number(candle.open), Number(candle.close)) ||
          Number(candle.high) < Math.max(Number(candle.open), Number(candle.close)))
        return { ok: false as const, error: "Invalid OHLC values", saved: 0 };
    }
    await this.repository.saveMany(candles);
    return { ok: true as const, error: "", saved: candles.length };
  }
}
