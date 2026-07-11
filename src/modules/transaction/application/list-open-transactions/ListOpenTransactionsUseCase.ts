import type { DagobertTransaction } from "../../domain/DagobertTransaction";
import type { TransactionRepository } from "../../domain/TransactionRepository";
import type { TradeStyle } from "../../domain/TradeStyle";
import type { TradeType } from "../../domain/TradeType";

export type ListOpenTransactionsQuery = {
  pair?: string;
  tradeType?: TradeType;
  tradeStyle?: TradeStyle;
};

export class ListOpenTransactionsUseCase {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async execute(query: ListOpenTransactionsQuery = {}): Promise<DagobertTransaction[]> {
    const transactions = await this.transactionRepository.findAll();

    return transactions
      .filter((transaction) => !transaction.grouped)
      .filter((transaction) => !query.pair || transaction.pair === query.pair)
      .filter(
        (transaction) => !query.tradeType || transaction.tradeType === query.tradeType
      )
      .filter(
        (transaction) => !query.tradeStyle || transaction.tradeStyle === query.tradeStyle
      )
      .sort((a, b) => b.dateEpoch - a.dateEpoch);
  }
}
