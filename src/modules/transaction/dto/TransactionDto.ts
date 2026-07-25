import type { DagobertTransaction } from "../domain/DagobertTransaction";
import type { TradeStyle } from "../domain/TradeStyle";
import type { TradeType } from "../domain/TradeType";

/** Stable JSON representation exposed by the transaction HTTP API. */
export type TransactionDto = {
  orderId: string;
  binanceApiId: number;
  pair: string;
  amount: number;
  executed: number;
  date: string;
  dateEpoch: number;
  side: string;
  price: number;
  status: string;
  grouped: boolean;
  note: string;
  otherSideOrderId: string;
  tradeType: TradeType;
  tradeStyle: TradeStyle;
};

export function toTransactionDto(transaction: DagobertTransaction): TransactionDto {
  return {
    ...transaction,
    date:
      transaction.date instanceof Date
        ? transaction.date.toISOString()
        : String(transaction.date),
  };
}
