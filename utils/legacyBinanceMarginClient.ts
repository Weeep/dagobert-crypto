import Binance from "binance-api-node";

/** @deprecated Remove together with the legacy Binance dependencies after margin migration. */
export const legacyBinanceMarginClient = Binance({
  apiKey: process.env.BAPI_KEY,
  apiSecret: process.env.BAPI_SEC,
  httpBase: process.env.BAPI_HTTPBASE,
});
