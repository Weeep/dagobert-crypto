import type { TransactionRepository } from "../../domain/TransactionRepository";
import type { TransactionMutationResult } from "../updateTransactionResult";

export class UpdateTransactionNoteUseCase {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async execute(orderId: string, note: string): Promise<TransactionMutationResult> {
    if (!orderId) {
      return { ok: false, error: "Missing orderId", transaction: null };
    }

    const transaction = await this.transactionRepository.findById(orderId);
    if (!transaction) {
      return {
        ok: false,
        error: `Transaction not found: ${orderId}`,
        transaction: null,
      };
    }

    const updatedTransaction = { ...transaction, note: note.trim() };
    await this.transactionRepository.save(updatedTransaction);

    return { ok: true, error: "", transaction: updatedTransaction };
  }
}
