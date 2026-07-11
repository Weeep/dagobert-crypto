import type { TransactionRepository } from "@/src/modules/transaction";
import type { DagobertPair } from "../../domain/DagobertPair";
import type { PairRepository } from "../../domain/PairRepository";
import type { CreatePairsFromTransactionsResult } from "../pairResults";

export class CreatePairsFromTransactionsUseCase {
  constructor(
    private readonly pairRepository: PairRepository,
    private readonly transactionRepository: TransactionRepository
  ) {}

  async execute(): Promise<CreatePairsFromTransactionsResult> {
    const transactions = await this.transactionRepository.findAll();
    const symbols = Array.from(
      new Set(
        transactions
          .map((transaction) => transaction.pair.trim().toUpperCase())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    const createdPairs: DagobertPair[] = [];
    const skippedPairs: DagobertPair[] = [];

    for (const symbol of symbols) {
      const existingPair = await this.pairRepository.findBySymbol(symbol);
      if (existingPair) {
        skippedPairs.push(existingPair);
        continue;
      }

      const pair: DagobertPair = { pair: symbol, decimals: 4, keyLevels: [] };
      await this.pairRepository.save(pair);
      createdPairs.push(pair);
    }

    return { ok: true, error: "", createdPairs, skippedPairs };
  }
}
