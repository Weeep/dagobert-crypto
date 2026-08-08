import type { Candle } from "../domain/Candle";
import type { CandleRepository } from "../domain/CandleRepository";
import type { CandleIngestionCheckpoint } from "../domain/CandleIngestionCursor";
import { CandleValidationError, validateClosedCandle } from "../domain/CandleValidation";
export class SaveCandlesUseCase {
  constructor(private readonly repository: CandleRepository) {}
  async execute(candles: Candle[], checkpoint?: CandleIngestionCheckpoint) {
    try {
      for (const candle of candles) validateClosedCandle(candle);
      if (checkpoint && candles.some((candle) => candle.source !== checkpoint.source ||
        candle.pairSymbol !== checkpoint.pairSymbol || candle.interval !== checkpoint.interval))
        throw new CandleValidationError("checkpoint identity does not match every candle");
      if (checkpoint && !candles.some((candle) =>
        candle.openTime.getTime() === checkpoint.lastClosedOpenTime.getTime()))
        throw new CandleValidationError("checkpoint must reference a candle in the batch");
    } catch (error) {
      return { ok: false as const,
        error: error instanceof Error ? error.message : "Invalid candle", saved: 0 };
    }
    await this.repository.saveMany(candles, checkpoint);
    return { ok: true as const, error: "", saved: candles.length };
  }
}
