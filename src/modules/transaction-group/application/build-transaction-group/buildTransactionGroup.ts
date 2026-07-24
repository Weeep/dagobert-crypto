import type { DagobertTransaction } from "@/src/modules/transaction";
import { TradeType } from "@/src/modules/transaction";
import type { DagobertTransactionGroup } from "../../domain/DagobertTransactionGroup";

export function buildTransactionGroup(
  transactions: DagobertTransaction[]
): DagobertTransactionGroup {
  const transactionGroup: DagobertTransactionGroup = {
    groupId: null,
    pair: "",
    tradeType: TradeType.Spot,
    amount: 0,
    executed: 0,
    lastTransDateEpoch: 0,
    groupedTrans: [],
    note: "",
  };

  for (const transaction of transactions) {
    transactionGroup.pair = transaction.pair;
    transactionGroup.tradeType = transaction.tradeType;
    transactionGroup.amount += transaction.amount;
    transactionGroup.executed +=
      transaction.side === "BUY"
        ? transaction.executed
        : -transaction.executed;
    transactionGroup.lastTransDateEpoch = Math.max(
      transactionGroup.lastTransDateEpoch,
      transaction.dateEpoch
    );
    transactionGroup.groupedTrans.push(transaction);
  }

  return transactionGroup;
}
