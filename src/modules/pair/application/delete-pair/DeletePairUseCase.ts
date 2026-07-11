import type { PairRepository } from "../../domain/PairRepository";
import type { DeletePairResult } from "../pairResults";

export class DeletePairUseCase {
  constructor(private readonly pairRepository: PairRepository) {}

  async execute(pair: string): Promise<DeletePairResult> {
    const symbol = pair.trim().toUpperCase();
    if (!symbol) {
      return { ok: false, error: "Missing pair" };
    }

    const existingPair = await this.pairRepository.findBySymbol(symbol);
    if (!existingPair) {
      return { ok: false, error: `Pair not found: ${symbol}` };
    }

    await this.pairRepository.delete(symbol);
    return { ok: true, error: "" };
  }
}
