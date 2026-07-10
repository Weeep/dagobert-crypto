import { TransactionIf } from "@/app/lib/Interfaces";
import type { DagobertTransaction } from "@/src/modules/transaction";
import { TradeType } from "@/src/modules/transaction";

export type { DagobertTransaction } from "@/src/modules/transaction";
export { TradeStyle, TradeType } from "@/src/modules/transaction";

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

export type DagobertPair = {
  pair: string;
  decimals: number;
  keyLevels: [];
};

export type ApiResponse = {
  ok: boolean;
  code: number;
  response: any;
  error: any;
};

/**
 * @deprecated Binance CSV import is kept for backward compatibility only.
 * Prefer importing orders through the Binance API flow.
 */
export type BnceTradeHisFromCsv = {
  "Date(UTC)": string; //"1/2/2025 7:34",
  Pair: string; //"POLUSDC",
  Side: string; //"BUY",
  Price: string; //"0.484",
  Executed: string; //"12POL",
  Amount: string; //"5.808USDC",
  Fee: string; //"0.00000615BNB"
};

export type TransactionsApiResponse = {
  transactions: TransactionIf[] | null;
  apiResponse: ApiResponse;
};

export enum KVRoot {
  users = "users",
  pairs = "pairs",
  dtransactions = "dtransactions",
  dtransactionGroups = "dtransactionGroups",
}

export enum DbActionsViaApi {
  connectiontest = "connectiontest",
  flushdb = "flushdb",
  getcache = "getcache",
  set = "set",
  hset = "hset",
  sadd = "sadd",
  del = "del",
  srem = "srem",
  hdel = "hdel",
}

export enum Color {
  SpotColor = "lime-600",
  MarginColor = "purple-400",
}
