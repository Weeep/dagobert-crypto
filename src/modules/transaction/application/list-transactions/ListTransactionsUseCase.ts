import type { DagobertTransaction } from "../../domain/DagobertTransaction";
import type { TransactionRepository } from "../../domain/TransactionRepository";

export class ListTransactionsUseCase {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async execute(): Promise<DagobertTransaction[]> {
    return this.transactionRepository.findAll();
  }
}
