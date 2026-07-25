import type { DagobertTransaction } from "../../domain/DagobertTransaction";
import type { TransactionRepository } from "../../domain/TransactionRepository";

export type GetTransactionResult =
  | { ok: true; error: ""; transaction: DagobertTransaction }
  | { ok: false; error: string; transaction: null };

export class GetTransactionUseCase {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async execute(orderId: string): Promise<GetTransactionResult> {
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

    return { ok: true, error: "", transaction };
  }
}
