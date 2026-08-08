import type { Candle } from "../domain/Candle";
import { MARKET_INTERVAL_MILLISECONDS } from "../domain/Candle";
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
      if (checkpoint) this.validateCheckpointBatchContinuity(candles, checkpoint);
    } catch (error) {
      return { ok: false as const,
        error: error instanceof Error ? error.message : "Invalid candle", saved: 0 };
    }
    await this.repository.saveMany(candles, checkpoint);
    return { ok: true as const, error: "", saved: candles.length };
  }

  private validateCheckpointBatchContinuity(candles: Candle[], checkpoint: CandleIngestionCheckpoint) {
    const intervalMilliseconds = MARKET_INTERVAL_MILLISECONDS[checkpoint.interval];
    const checkpointTime = checkpoint.lastClosedOpenTime.getTime();
    const openTimes = candles
      .map((candle) => candle.openTime.getTime())
      .filter((openTime) => openTime <= checkpointTime)
      .sort((left, right) => left - right);
    for (let index = 1; index < openTimes.length; index += 1) {
      if (openTimes[index] - openTimes[index - 1] !== intervalMilliseconds)
        throw new CandleValidationError("checkpoint batch contains a candle gap or duplicate");
    }
  }
}
