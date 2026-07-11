import type { TradeType } from "@/src/modules/transaction";
import type { DagobertTransactionGroup } from "../../domain/DagobertTransactionGroup";
import type { TransactionGroupRepository } from "../../domain/TransactionGroupRepository";

export type ListTransactionGroupsQuery = {
  pair?: string;
  tradeType?: TradeType;
};

export class ListTransactionGroupsUseCase {
  constructor(
    private readonly transactionGroupRepository: TransactionGroupRepository
  ) {}

  async execute(
    query: ListTransactionGroupsQuery = {}
  ): Promise<DagobertTransactionGroup[]> {
    const transactionGroups = await this.transactionGroupRepository.findAll();

    return transactionGroups
      .filter((group) => !query.pair || group.pair === query.pair)
      .filter((group) => !query.tradeType || group.tradeType === query.tradeType)
      .sort((a, b) => b.lastTransDateEpoch - a.lastTransDateEpoch);
  }
}
