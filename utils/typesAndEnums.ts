import { TransactionIf } from "@/app/lib/Interfaces";

export type { DagobertPair } from "@/src/modules/pair/domain/DagobertPair";
export type { DagobertTransaction } from "@/src/modules/transaction/domain/DagobertTransaction";
export type { DagobertTransactionGroup } from "@/src/modules/transaction-group/domain/DagobertTransactionGroup";
export { TradeStyle } from "@/src/modules/transaction/domain/TradeStyle";
export { TradeType } from "@/src/modules/transaction/domain/TradeType";

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
