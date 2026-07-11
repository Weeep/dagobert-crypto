import type { DagobertPair } from "../../domain/DagobertPair";
import type { PairRepository } from "../../domain/PairRepository";

export class ListPairsUseCase {
  constructor(private readonly pairRepository: PairRepository) {}

  async execute(): Promise<DagobertPair[]> {
    const pairs = await this.pairRepository.findAll();
    return pairs.sort((a, b) => a.pair.localeCompare(b.pair));
  }
}
