import type { PairRepository } from "../../domain/PairRepository";
import type { GetPairResult } from "../pairResults";

export class GetPairUseCase {
  constructor(private readonly pairRepository: PairRepository) {}

  async execute(pair: string): Promise<GetPairResult> {
    const symbol = pair.trim().toUpperCase();
    if (!symbol) {
      return { ok: false, error: "Missing pair", pair: null };
    }

    const dagobertPair = await this.pairRepository.findBySymbol(symbol);
    if (!dagobertPair) {
      return { ok: false, error: `Pair not found: ${symbol}`, pair: null };
    }

    return { ok: true, error: "", pair: dagobertPair };
  }
}
