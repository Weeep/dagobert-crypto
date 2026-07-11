import type { DagobertTransactionGroup } from "../../domain/DagobertTransactionGroup";
import type { TransactionGroupRepository } from "../../domain/TransactionGroupRepository";

export type GetTransactionGroupResult =
  | { ok: true; error: ""; transactionGroup: DagobertTransactionGroup }
  | { ok: false; error: string; transactionGroup: null };

export class GetTransactionGroupUseCase {
  constructor(
    private readonly transactionGroupRepository: TransactionGroupRepository
  ) {}

  async execute(groupId: string): Promise<GetTransactionGroupResult> {
    if (!groupId) {
      return { ok: false, error: "Missing groupId", transactionGroup: null };
    }

    const transactionGroup = await this.transactionGroupRepository.findById(groupId);
    if (!transactionGroup) {
      return {
        ok: false,
        error: `Transaction group not found: ${groupId}`,
        transactionGroup: null,
      };
    }

    return { ok: true, error: "", transactionGroup };
  }
}
