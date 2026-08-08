import type { CandleRepository } from "../domain/CandleRepository";
import type { MarketInterval } from "../domain/Candle";
export class ListCandlesUseCase {
  constructor(private readonly repository: CandleRepository) {}
  execute(pairSymbol: string, interval: MarketInterval, from: Date, to: Date) {
    return this.repository.findRange(pairSymbol.trim().toUpperCase(), interval, from, to);
  }
}
