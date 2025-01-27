/*
"symbol": "SOLUSDT",
"orderId": 2805178958,
"executedQty": "0.62000000",
"cummulativeQuoteQty": "24.90540000",
"status": "FILLED",
"type": "LIMIT",
"side": "BUY",
"updateTime": 1654168978315,
*/
export interface TransactionIf {
  symbol: string;
  orderId: number;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: string;
  type: string;
  side: string;
  updateTime: number;
}

export interface PairPriceIf {
  pair: string;
  price: number;
  numOfTransactions: number;
}
