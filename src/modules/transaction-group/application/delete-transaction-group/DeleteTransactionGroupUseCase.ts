import type { TransactionRepository } from "@/src/modules/transaction";
import type { TransactionGroupRepository } from "../../domain/TransactionGroupRepository";

export class DeleteTransactionGroupUseCase {
  constructor(
    private readonly transactionGroupRepository: TransactionGroupRepository,
    private readonly transactionRepository: TransactionRepository
  ) {}

  async execute(groupId: string): Promise<boolean> {
    const transactionGroup = await this.transactionGroupRepository.findById(groupId);

    if (!transactionGroup) {
      console.error("No group with id: " + groupId);
      return false;
    }

    for (const dtransaction of transactionGroup.groupedTrans) {
      await this.transactionRepository.save({
        ...dtransaction,
        grouped: false,
      });
    }

    await this.transactionGroupRepository.delete(groupId);
    return true;
  }
}
