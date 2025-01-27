import Binance from "binance-api-node";

const apiKey: string = process.env.BAPI_KEY as string;
const apiSecret: string = process.env.BAPI_SEC as string;
const httpBase: string = process.env.BAPI_HTTPBASE as string;

export const binanceClient = Binance({ apiKey, apiSecret, httpBase });

// Binance API doc
// https://binance-docs.github.io/apidocs/spot/en/#symbol-price-ticker
