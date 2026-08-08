import type { CandleRepository } from "../domain/CandleRepository";
export class ListCandlesUseCase {
  constructor(private readonly repository: CandleRepository) {}
  execute(pairSymbol: string, interval: string, from: Date, to: Date) {
    return this.repository.findRange(pairSymbol.trim().toUpperCase(), interval, from, to);
  }
}
