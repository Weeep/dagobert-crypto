import { TransactionIf } from "@/app/lib/Interfaces";

export type DagobertTransaction = {
  orderId: string;
  binanceApiId: number;
  pair: string; // SOLUSDC
  amount: number; //incomeUsd 8.03
  executed: number; //qty 0.041
  date: Date; //24. 12. 29.
  dateEpoch: number;
  side: string; // SELL
  price: number; // 195.94
  status: string; //FILLED
  grouped: boolean;
  note: string;
  otherSideOrderId: string;
  tradeType: TradeType;
  tradeStyle: TradeStyle;
};

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
};

export type ApiResponse = {
  ok: boolean;
  code: number;
  response: any;
  error: any;
};

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
  pairs = "pairs",
  dtransactions = "dtransactions",
  dtransactionGroups = "dtransactionGroups",
}

export enum DbActionsViaApi {
  connectiontest = "connectiontest",
  flushdb = "flushdb",
  getcachefromkv = "getcachefromkv",
  getcachefromfile = "getcachefromfile",
  set = "set",
  hset = "hset",
  sadd = "sadd",
  del = "del",
  srem = "srem",
  hdel = "hdel",
}

export enum TradeType {
  Spot = "spot",
  Margin = "margin",
}

export enum TradeStyle {
  Day = "day",
  Swing = "swing",
  Hodling = "hodling",
  Trash = "trash",
}

export enum Color {
  SpotColor = "lime-600",
  MarginColor = "purple-400",
}
