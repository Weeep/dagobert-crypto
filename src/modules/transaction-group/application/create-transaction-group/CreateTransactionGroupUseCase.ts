import type { TransactionRepository } from "@/src/modules/transaction";
import type { DagobertTransactionGroup } from "../../domain/DagobertTransactionGroup";
import type { TransactionGroupRepository } from "../../domain/TransactionGroupRepository";
import { v4 as uuidv4 } from "uuid";

export type CreateTransactionGroupResult = {
  ok: boolean;
  error: string;
  response: { groupedTransactions: DagobertTransactionGroup[] } | null;
};

export class CreateTransactionGroupUseCase {
  constructor(
    private readonly transactionGroupRepository: TransactionGroupRepository,
    private readonly transactionRepository: TransactionRepository
  ) {}

  async execute(
    transactionGroups: DagobertTransactionGroup[]
  ): Promise<CreateTransactionGroupResult> {
    if (!transactionGroups) {
      return { ok: false, error: "Missing data", response: null };
    }

    if (!this.isValidInput(transactionGroups)) {
      return {
        ok: false,
        error: "Invalid data: " + JSON.stringify(transactionGroups),
        response: null,
      };
    }

    const groupedTransactions: DagobertTransactionGroup[] = [];

    for (const transactionGroup of transactionGroups) {
      const groupToSave: DagobertTransactionGroup = {
        ...transactionGroup,
        groupId: transactionGroup.groupId ?? uuidv4(),
      };

      await this.transactionGroupRepository.save(groupToSave);

      for (const dtransaction of groupToSave.groupedTrans) {
        await this.transactionRepository.save({
          ...dtransaction,
          grouped: true,
        });
      }

      groupedTransactions.push(groupToSave);
    }

    return {
      ok: true,
      error: "",
      response: { groupedTransactions },
    };
  }

  private isValidInput(transactionGroups: DagobertTransactionGroup[]): boolean {
    return (
      transactionGroups.length > 0 &&
      transactionGroups.every(
        (transactionGroup) =>
          Boolean(transactionGroup.pair) &&
          Array.isArray(transactionGroup.groupedTrans)
      )
    );
  }
}
