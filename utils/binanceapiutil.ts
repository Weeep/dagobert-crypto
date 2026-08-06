import { Spot } from "@binance/spot";

const apiKey = process.env.BAPI_KEY;
const apiSecret = process.env.BAPI_SEC;
const basePath = process.env.BAPI_HTTPBASE;

type OfficialResponse<T> = { data(): Promise<T> };

type SpotRestApi = {
  ping(): Promise<OfficialResponse<unknown>>;
  time(): Promise<OfficialResponse<{ serverTime: number }>>;
  account(options?: Record<string, unknown>): Promise<OfficialResponse<any>>;
  allOrders(options: Record<string, unknown>): Promise<OfficialResponse<any[]>>;
  getOpenOrders(
    options?: Record<string, unknown>
  ): Promise<OfficialResponse<any[]>>;
  newOrder(options: Record<string, unknown>): Promise<OfficialResponse<any>>;
  deleteOrder(options: Record<string, unknown>): Promise<OfficialResponse<any>>;
  klines(options: Record<string, unknown>): Promise<OfficialResponse<any[][]>>;
  tickerPrice(options?: Record<string, unknown>): Promise<OfficialResponse<any>>;
  ticker24hr(options?: Record<string, unknown>): Promise<OfficialResponse<any>>;
};

const sdk = new Spot({
  configurationRestAPI: {
    apiKey,
    apiSecret,
    ...(basePath ? { basePath } : {}),
  },
});

const rest = sdk.restAPI as unknown as SpotRestApi;
const data = async <T>(request: Promise<OfficialResponse<T>>): Promise<T> =>
  (await request).data();
const withoutLegacyOptions = <T extends Record<string, unknown>>(options: T) => {
  const { useServerTime: _useServerTime, ...sdkOptions } = options;
  return sdkOptions;
};

/**
 * Compatibility facade for the official Binance Spot SDK. Keeping the existing
 * application-facing methods makes this migration independent from the later
 * removal of the two legacy Binance packages.
 */
export const binanceClient = {
  async ping() {
    await data(rest.ping());
    return true;
  },
  async time() {
    return (await data(rest.time())).serverTime;
  },
  accountInfo(options: Record<string, unknown>) {
    return data(rest.account(withoutLegacyOptions(options)));
  },
  allOrders(options: Record<string, unknown>) {
    return data(rest.allOrders(withoutLegacyOptions(options)));
  },
  openOrders(options: Record<string, unknown>) {
    return data(rest.getOpenOrders(withoutLegacyOptions(options)));
  },
  order(options: Record<string, unknown>) {
    return data(rest.newOrder(withoutLegacyOptions(options)));
  },
  cancelOrder(options: Record<string, unknown>) {
    return data(rest.deleteOrder(withoutLegacyOptions(options)));
  },
  async candles(options: object) {
    const rows = await data(
      rest.klines(withoutLegacyOptions(options as Record<string, unknown>))
    );
    return rows.map((row) => ({
      openTime: row[0],
      open: row[1],
      high: row[2],
      low: row[3],
      close: row[4],
      volume: row[5],
      closeTime: row[6],
      quoteAssetVolume: row[7],
      trades: row[8],
      baseAssetVolume: row[9],
      quoteVolume: row[10],
    }));
  },
  async prices(options: Record<string, unknown> = {}) {
    const result = await data(rest.tickerPrice(options));
    if (!Array.isArray(result)) return { [result.symbol]: result.price };
    return Object.fromEntries(result.map(({ symbol, price }) => [symbol, price]));
  },
  dailyStats(options: Record<string, unknown> = {}) {
    return data(rest.ticker24hr(options));
  },
};
