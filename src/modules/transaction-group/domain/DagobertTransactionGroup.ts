import type { DagobertTransaction } from "@/src/modules/transaction";
import { TradeType } from "@/src/modules/transaction";

export type DagobertTransactionGroup = {
  groupId: string | null;
  pair: string;
  amount: number; //incomeUsd
  executed: number; //qty
  tradeType: TradeType;
  lastTransDateEpoch: number;
  groupedTrans: DagobertTransaction[];
  note: string;
};
