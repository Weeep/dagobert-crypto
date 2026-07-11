import type { TransactionIf } from "@/app/lib/Interfaces";
import { getPrice, stringToRoundedFloat } from "@/utils/helper";
import type { DagobertTransaction } from "../../domain/DagobertTransaction";
import { TradeStyle } from "../../domain/TradeStyle";
import { TradeType } from "../../domain/TradeType";
import { v4 as uuidv4 } from "uuid";

export function binanceOrderToTransaction(
  apiTransaction: TransactionIf,
  tradeType: TradeType
): DagobertTransaction {
  const cqq = stringToRoundedFloat(apiTransaction.cummulativeQuoteQty, 2);

  return {
    orderId: uuidv4(),
    binanceApiId: apiTransaction.orderId,
    pair: apiTransaction.symbol,
    amount: apiTransaction.side === "SELL" ? cqq : 0 - cqq,
    dateEpoch: apiTransaction.updateTime - 61 * 60_000,
    date: new Date(apiTransaction.updateTime),
    side: apiTransaction.side,
    executed: stringToRoundedFloat(apiTransaction.executedQty),
    price: stringToRoundedFloat(
      getPrice(apiTransaction.cummulativeQuoteQty, apiTransaction.executedQty)
    ),
    status: apiTransaction.status,
    grouped: false,
    note: "",
    otherSideOrderId: "",
    tradeType,
    tradeStyle: TradeStyle.Swing,
  };
}

export function binanceOrdersToTransactionsByPair(
  apiTransactions: TransactionIf[],
  tradeType: TradeType
): Record<string, DagobertTransaction[]> {
  return apiTransactions.reduce<Record<string, DagobertTransaction[]>>(
    (dtransactionsPerPair, apiTransaction) => {
      const dtransaction = binanceOrderToTransaction(apiTransaction, tradeType);
      dtransactionsPerPair[apiTransaction.symbol] =
        dtransactionsPerPair[apiTransaction.symbol] ?? [];
      dtransactionsPerPair[apiTransaction.symbol].push(dtransaction);
      return dtransactionsPerPair;
    },
    {}
  );
}
