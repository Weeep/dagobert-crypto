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
interface TransactionIf {
    symbol: string;
    orderId: number;
    executedQty: number;
    cummulativeQuoteQty: number;
    status: string;
    type: string;
    side: string;
    updateTime: number;
}

export default TransactionIf;