import type { DagobertTransaction } from "@/src/modules/transaction/domain/DagobertTransaction";
import { TradeType } from "@/src/modules/transaction/domain/TradeType";
import type { DagobertTransactionGroup } from "@/src/modules/transaction-group/domain/DagobertTransactionGroup";
import { CreateTransactionGroupUseCase } from "@/src/modules/transaction-group/application/create-transaction-group/CreateTransactionGroupUseCase";
import { DeleteTransactionGroupUseCase } from "@/src/modules/transaction-group/application/delete-transaction-group/DeleteTransactionGroupUseCase";
import { GetTransactionGroupUseCase } from "@/src/modules/transaction-group/application/get-transaction-group/GetTransactionGroupUseCase";
import { ListTransactionGroupsUseCase } from "@/src/modules/transaction-group/application/list-transaction-groups/ListTransactionGroupsUseCase";
import { KvTransactionGroupRepository } from "@/src/modules/transaction-group/infrastructure/kv/KvTransactionGroupRepository";
import { KvTransactionRepository } from "@/src/modules/transaction/infrastructure/kv/KvTransactionRepository";

class DtransactionGroups {
  private static readonly transactionGroupRepository =
    new KvTransactionGroupRepository();
  private static readonly transactionRepository = new KvTransactionRepository();
  private static readonly createTransactionGroupUseCase =
    new CreateTransactionGroupUseCase(
      DtransactionGroups.transactionGroupRepository,
      DtransactionGroups.transactionRepository
    );
  private static readonly deleteTransactionGroupUseCase =
    new DeleteTransactionGroupUseCase(
      DtransactionGroups.transactionGroupRepository,
      DtransactionGroups.transactionRepository
    );
  private static readonly listTransactionGroupsUseCase =
    new ListTransactionGroupsUseCase(DtransactionGroups.transactionGroupRepository);
  private static readonly getTransactionGroupUseCase =
    new GetTransactionGroupUseCase(DtransactionGroups.transactionGroupRepository);

  static async post(transactionGroups: DagobertTransactionGroup[]) {
    return this.createTransactionGroupUseCase.execute(transactionGroups);
  }

  static async getAll(): Promise<DagobertTransactionGroup[]> {
    return this.listTransactionGroupsUseCase.execute();
  }

  static async get(id: string): Promise<DagobertTransactionGroup | null> {
    const result = await this.getTransactionGroupUseCase.execute(id);
    return result.ok ? result.transactionGroup : null;
  }

  static async del(groupId: string): Promise<boolean> {
    return this.deleteTransactionGroupUseCase.execute(groupId);
  }

  static group(dtransactions: DagobertTransaction[]): DagobertTransactionGroup {
    let transactionGroup: DagobertTransactionGroup = {
      groupId: null,
      pair: "",
      tradeType: TradeType.Spot,
      amount: 0,
      executed: 0,
      lastTransDateEpoch: 0,
      groupedTrans: [],
      note: "",
    };

    for (const dtrans of dtransactions) {
      //const dTrans = dtrans.dtransaction;

      transactionGroup.pair = dtrans.pair; //TODO same pair WARNING validation needed, AVAX and SOL cannot be grouped
      transactionGroup.tradeType = dtrans.tradeType; //TODO same tradeType ERROR validation needed
      transactionGroup.amount += dtrans.amount;
      transactionGroup.executed =
        dtrans.side === "BUY"
          ? transactionGroup.executed + dtrans.executed
          : transactionGroup.executed - dtrans.executed;
      transactionGroup.lastTransDateEpoch =
        transactionGroup.lastTransDateEpoch === 0
          ? dtrans.dateEpoch
          : dtrans.dateEpoch > transactionGroup.lastTransDateEpoch
          ? dtrans.dateEpoch
          : transactionGroup.lastTransDateEpoch;
      transactionGroup.groupedTrans.push(dtrans);
    }

    return transactionGroup;
  }
}

export default DtransactionGroups;
