import type { DagobertTransaction } from "@/src/modules/transaction";
import { TradeType } from "@/src/modules/transaction";
import type { DagobertTransactionGroup } from "../../domain/DagobertTransactionGroup";

export function buildTransactionGroup(
  transactions: DagobertTransaction[]
): DagobertTransactionGroup {
  validateTransactionsBelongToSameGroup(transactions);

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

function validateTransactionsBelongToSameGroup(
  transactions: DagobertTransaction[]
): void {
  const firstTransaction = transactions[0];
  if (!firstTransaction) return;

  if (transactions.some(({ pair }) => pair !== firstTransaction.pair)) {
    throw new Error("Cannot group transactions with different pairs");
  }

  if (
    transactions.some(
      ({ tradeType }) => tradeType !== firstTransaction.tradeType
    )
  ) {
    throw new Error("Cannot group transactions with different trade types");
  }
}
