import type { TransactionRepository } from "../../domain/TransactionRepository";
import type { TransactionMutationResult } from "../updateTransactionResult";

export type SetOtherSideOrderInput = {
  orderId: string;
  otherSideOrderId: string | number;
  note?: string;
};

export class SetOtherSideOrderUseCase {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async execute(input: SetOtherSideOrderInput): Promise<TransactionMutationResult> {
    if (!input.orderId) {
      return { ok: false, error: "Missing orderId", transaction: null };
    }
    const otherSideOrderId = input.otherSideOrderId.toString().trim();
    if (!otherSideOrderId) {
      return { ok: false, error: "Missing otherSideOrderId", transaction: null };
    }

    const transaction = await this.transactionRepository.findById(input.orderId);
    if (!transaction) {
      return {
        ok: false,
        error: `Transaction not found: ${input.orderId}`,
        transaction: null,
      };
    }

    const updatedTransaction = {
      ...transaction,
      otherSideOrderId,
      note: input.note === undefined ? transaction.note : input.note.trim(),
    };
    await this.transactionRepository.save(updatedTransaction);

    return { ok: true, error: "", transaction: updatedTransaction };
  }
}
