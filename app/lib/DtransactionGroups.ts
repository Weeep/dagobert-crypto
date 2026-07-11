import { KVRoot } from "@/src/shared/infrastructure/kv/KVRoot";
import type { DagobertTransaction } from "@/src/modules/transaction/domain/DagobertTransaction";
import { TradeType } from "@/src/modules/transaction/domain/TradeType";
import type { DagobertTransactionGroup } from "@/src/modules/transaction-group/domain/DagobertTransactionGroup";
import { CreateTransactionGroupUseCase } from "@/src/modules/transaction-group/application/create-transaction-group/CreateTransactionGroupUseCase";
import { DeleteTransactionGroupUseCase } from "@/src/modules/transaction-group/application/delete-transaction-group/DeleteTransactionGroupUseCase";
import { KvTransactionGroupRepository } from "@/src/modules/transaction-group/infrastructure/kv/KvTransactionGroupRepository";
import { KvTransactionRepository } from "@/src/modules/transaction/infrastructure/kv/KvTransactionRepository";
import ClientSideDbCache from "./ClientSideDbCache";

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

  static async post(transactionGroups: DagobertTransactionGroup[]) {
    return this.createTransactionGroupUseCase.execute(transactionGroups);
  }

  static getAll(): DagobertTransactionGroup[] | null {
    let tranGroups = ClientSideDbCache.hgetall(KVRoot.dtransactionGroups);

    if (tranGroups === null) return null;

    return Object.values(tranGroups) as DagobertTransactionGroup[];
  }

  static get(id: string): DagobertTransactionGroup | null {
    if (!id) return null;

    return ClientSideDbCache.hget(
      KVRoot.dtransactionGroups,
      id as string
    ) as DagobertTransactionGroup;
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
