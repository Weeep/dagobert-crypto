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

const data = async <T>(request: Promise<OfficialResponse<T>>): Promise<T> =>
  (await request).data();
const withoutLegacyOptions = <T extends Record<string, unknown>>(options: T) => {
  const { useServerTime: _useServerTime, ...sdkOptions } = options;
  return sdkOptions;
};

const signedOptions = async <T extends Record<string, unknown>>(
  rest: SpotRestApi,
  options: T
) => {
  const sdkOptions = withoutLegacyOptions(options);
  if (!options.useServerTime) return sdkOptions;

  const { serverTime } = await data(rest.time());
  return { ...sdkOptions, timestamp: serverTime };
};

const orderOptions = (options: Record<string, unknown>) => {
  const needsTimeInForce = [
    "LIMIT",
    "STOP_LOSS_LIMIT",
    "TAKE_PROFIT_LIMIT",
  ].includes(String(options.type));

  return needsTimeInForce && !options.timeInForce
    ? { timeInForce: "GTC", ...options }
    : options;
};

/**
 * Compatibility facade for the official Binance Spot SDK. Keeping the existing
 * application-facing methods makes this migration independent from the later
 * removal of the two legacy Binance packages.
 */
export const createBinanceClient = (rest: SpotRestApi) => ({
  async ping() {
    await data(rest.ping());
    return true;
  },
  async time() {
    return (await data(rest.time())).serverTime;
  },
  async accountInfo(options: Record<string, unknown>) {
    return data(rest.account(await signedOptions(rest, options)));
  },
  async allOrders(options: Record<string, unknown>) {
    return data(rest.allOrders(await signedOptions(rest, options)));
  },
  async openOrders(options: Record<string, unknown>) {
    return data(rest.getOpenOrders(await signedOptions(rest, options)));
  },
  async order(options: Record<string, unknown>) {
    return data(
      rest.newOrder(await signedOptions(rest, orderOptions(options)))
    );
  },
  async cancelOrder(options: Record<string, unknown>) {
    return data(rest.deleteOrder(await signedOptions(rest, options)));
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
      quoteVolume: row[7],
      trades: row[8],
      baseAssetVolume: row[9],
      quoteAssetVolume: row[10],
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
});

export const binanceClient = createBinanceClient(
  sdk.restAPI as unknown as SpotRestApi
);
