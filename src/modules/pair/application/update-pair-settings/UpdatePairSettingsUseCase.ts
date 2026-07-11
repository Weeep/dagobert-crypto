import type { PairRepository } from "../../domain/PairRepository";
import type { PairMutationResult } from "../pairResults";

export type UpdatePairSettingsInput = {
  pair: string;
  decimals: number;
  keyLevels: number[];
};

export class UpdatePairSettingsUseCase {
  constructor(private readonly pairRepository: PairRepository) {}

  async execute(input: UpdatePairSettingsInput): Promise<PairMutationResult> {
    const symbol = input.pair.trim().toUpperCase();
    if (!symbol) {
      return { ok: false, error: "Missing pair", pair: null };
    }
    if (!Number.isInteger(input.decimals) || input.decimals < 0) {
      return { ok: false, error: "Invalid decimals", pair: null };
    }

    const existingPair = await this.pairRepository.findBySymbol(symbol);
    if (!existingPair) {
      return { ok: false, error: `Pair not found: ${symbol}`, pair: null };
    }

    const updatedPair = {
      ...existingPair,
      decimals: input.decimals,
      keyLevels: input.keyLevels.filter((keyLevel) => Number.isFinite(keyLevel)),
    };

    await this.pairRepository.save(updatedPair);
    return { ok: true, error: "", pair: updatedPair };
  }
}
