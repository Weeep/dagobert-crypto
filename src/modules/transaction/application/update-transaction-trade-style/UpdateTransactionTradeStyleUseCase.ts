import { TradeStyle } from "../../domain/TradeStyle";
import type { TransactionRepository } from "../../domain/TransactionRepository";
import type { TransactionMutationResult } from "../updateTransactionResult";

export class UpdateTransactionTradeStyleUseCase {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async execute(orderId: string, tradeStyle: TradeStyle): Promise<TransactionMutationResult> {
    if (!orderId) {
      return { ok: false, error: "Missing orderId", transaction: null };
    }
    if (!Object.values(TradeStyle).includes(tradeStyle)) {
      return {
        ok: false,
        error: `Invalid tradeStyle: ${tradeStyle}`,
        transaction: null,
      };
    }

    const transaction = await this.transactionRepository.findById(orderId);
    if (!transaction) {
      return {
        ok: false,
        error: `Transaction not found: ${orderId}`,
        transaction: null,
      };
    }

    const updatedTransaction = { ...transaction, tradeStyle };
    await this.transactionRepository.save(updatedTransaction);

    return { ok: true, error: "", transaction: updatedTransaction };
  }
}
