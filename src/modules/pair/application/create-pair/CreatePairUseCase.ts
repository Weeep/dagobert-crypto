import type { DagobertPair } from "../../domain/DagobertPair";
import type { PairRepository } from "../../domain/PairRepository";
import type { PairMutationResult } from "../pairResults";

export type CreatePairInput = {
  pair: string;
  decimals?: number;
  keyLevels?: number[];
};

export class CreatePairUseCase {
  constructor(private readonly pairRepository: PairRepository) {}

  async execute(input: CreatePairInput): Promise<PairMutationResult> {
    const symbol = this.normalizeSymbol(input.pair);
    if (!symbol) {
      return { ok: false, error: "Missing pair", pair: null };
    }

    const existingPair = await this.pairRepository.findBySymbol(symbol);
    if (existingPair) {
      return { ok: false, error: `Pair already exists: ${symbol}`, pair: null };
    }

    const pair: DagobertPair = {
      pair: symbol,
      decimals: this.normalizeDecimals(input.decimals),
      keyLevels: this.normalizeKeyLevels(input.keyLevels),
    };

    await this.pairRepository.save(pair);
    return { ok: true, error: "", pair };
  }

  private normalizeSymbol(pair: string): string {
    return pair.trim().toUpperCase();
  }

  private normalizeDecimals(decimals: number | undefined): number {
    if (decimals === undefined) {
      return 4;
    }

    return Number.isInteger(decimals) && decimals >= 0 ? decimals : 4;
  }

  private normalizeKeyLevels(keyLevels: number[] | undefined): number[] {
    return keyLevels?.filter((keyLevel) => Number.isFinite(keyLevel)) ?? [];
  }
}
