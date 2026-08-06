import test, { describe } from "node:test";
import assert from "node:assert/strict";
import type { NextApiRequest, NextApiResponse } from "next";

import type { DagobertPair, PairRepository } from "@/src/modules/pair";
import { createPairsReadHandler } from "@/src/modules/pair/infrastructure/http/pairsReadHandler";
import type {
  DagobertTransaction,
  TransactionRepository,
} from "@/src/modules/transaction";
import { TradeStyle, TradeType } from "@/src/modules/transaction";
import { createTransactionsReadHandler } from "@/src/modules/transaction/infrastructure/http/transactionsReadHandler";
import { createTransactionEpochHandler } from "@/src/modules/transaction/infrastructure/http/transactionEpochHandler";
import type {
  DagobertTransactionGroup,
  TransactionGroupRepository,
} from "@/src/modules/transaction-group";
import { createTransactionGroupsReadHandler } from "@/src/modules/transaction-group/infrastructure/http/transactionGroupsReadHandler";
import { createUseCases } from "@/src/shared/composition/createUseCases";
import { generateToken, withAuth } from "@/utils/auth";
import { createDatabaseHealthHandler } from "@/src/shared/infrastructure/http/databaseHealthHandler";
import { createBinanceHealthHandler } from "@/src/shared/infrastructure/http/binanceHealthHandler";
import type { Account } from "binance-api-node";
import {
  createBinanceClient,
  type binanceClient,
} from "@/utils/binanceapiutil";
import type Binance from "binance-api-node";
import { createSpotHandler } from "@/pages/api/binanceapi/spot";
import { createMarginHandler } from "@/pages/api/binanceapi/margin";

type MockResponse = {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  response: NextApiResponse;
};

function createMockResponse(): MockResponse {
  const state: MockResponse = {
    statusCode: 200,
    body: undefined,
    headers: {},
    response: undefined as unknown as NextApiResponse,
  };
  state.response = {
    status(code: number) {
      state.statusCode = code;
      return this;
    },
    json(body: unknown) {
      state.body = body;
      return this;
    },
    setHeader(name: string, value: string | number | readonly string[]) {
      state.headers[name] = Array.isArray(value) ? value.join(", ") : String(value);
      return this;
    },
  } as unknown as NextApiResponse;
  return state;
}

function request(
  method = "GET",
  query: NextApiRequest["query"] = {},
  body?: unknown
): NextApiRequest {
  return { method, query, body, headers: {} } as NextApiRequest;
}

const transaction: DagobertTransaction = {
  orderId: "tx-1",
  binanceApiId: 123,
  pair: "SOLUSDC",
  amount: -50,
  executed: 0.5,
  date: new Date("2025-01-02T12:00:00.000Z"),
  dateEpoch: Date.parse("2025-01-02T12:00:00.000Z"),
  side: "BUY",
  price: 100,
  status: "FILLED",
  grouped: true,
  note: "test",
  otherSideOrderId: "",
  tradeType: TradeType.Spot,
  tradeStyle: TradeStyle.Swing,
};

const pair: DagobertPair = {
  pair: "SOLUSDC",
  decimals: 4,
  keyLevels: [100],
};

const group: DagobertTransactionGroup = {
  groupId: "group-1",
  pair: "SOLUSDC",
  amount: -50,
  executed: 0.5,
  tradeType: TradeType.Spot,
  lastTransDateEpoch: transaction.dateEpoch,
  groupedTrans: [transaction],
  note: "group note",
};

function createReadUseCases() {
  const pairs = new Map([[pair.pair, pair]]);
  const transactions = new Map([[transaction.orderId, transaction]]);
  const groups = new Map([[group.groupId, group]]);
  const pairRepository: PairRepository = {
    findAll: async () => Array.from(pairs.values()),
    findBySymbol: async (symbol) => pairs.get(symbol.trim().toUpperCase()) ?? null,
    save: async (value) => void pairs.set(value.pair, value),
    delete: async (symbol) => void pairs.delete(symbol),
  };
  const transactionRepository: TransactionRepository = {
    findAll: async () => Array.from(transactions.values()),
    findById: async (id) => transactions.get(id) ?? null,
    save: async (value) => void transactions.set(value.orderId, value),
    saveMany: async (values) => values.forEach((value) => transactions.set(value.orderId, value)),
    getLastProcessedEpoch: async () => null,
    setLastProcessedEpoch: async () => {},
  };
  const transactionGroupRepository: TransactionGroupRepository = {
    findAll: async () => Array.from(groups.values()),
    findById: async (id) => groups.get(id) ?? null,
    save: async (value) => void groups.set(value.groupId, value),
    delete: async (id) => void groups.delete(id),
  };
  return createUseCases({
    pairRepository,
    transactionRepository,
    transactionGroupRepository,
  });
}

describe("read API integration", () => {
  test("pairs API listáz és symbol alapján egy elemet ad vissza", async () => {
    const handler = createPairsReadHandler(createReadUseCases());
    const listResponse = createMockResponse();
    await handler(request(), listResponse.response);
    assert.equal(listResponse.statusCode, 200);
    assert.deepEqual(listResponse.body, { data: [pair] });

    const getResponse = createMockResponse();
    await handler(request("GET", { symbol: " solusdc " }), getResponse.response);
    assert.equal(getResponse.statusCode, 200);
    assert.deepEqual(getResponse.body, { data: pair });
  });

  test("transactions API listáz, id alapján olvas és ISO string DTO-vá alakítja a dátumot", async () => {
    const handler = createTransactionsReadHandler(createReadUseCases());
    const expectedDto = { ...transaction, date: "2025-01-02T12:00:00.000Z" };
    const listResponse = createMockResponse();
    await handler(request(), listResponse.response);
    assert.deepEqual(listResponse.body, { data: [expectedDto] });

    const getResponse = createMockResponse();
    await handler(request("GET", { id: "tx-1" }), getResponse.response);
    assert.equal(getResponse.statusCode, 200);
    assert.deepEqual(getResponse.body, { data: expectedDto });
  });

  test("transaction-groups API listáz, id alapján olvas és a nested transaction DTO-t is alakítja", async () => {
    const handler = createTransactionGroupsReadHandler(createReadUseCases());
    const expectedDto = {
      ...group,
      groupedTrans: [{ ...transaction, date: "2025-01-02T12:00:00.000Z" }],
    };
    const listResponse = createMockResponse();
    await handler(request(), listResponse.response);
    assert.deepEqual(listResponse.body, { data: [expectedDto] });

    const getResponse = createMockResponse();
    await handler(request("GET", { id: "group-1" }), getResponse.response);
    assert.equal(getResponse.statusCode, 200);
    assert.deepEqual(getResponse.body, { data: expectedDto });
  });

  test("mindhárom API egységes 404 választ ad hiányzó rekordra", async () => {
    const useCases = createReadUseCases();
    const cases = [
      [createPairsReadHandler(useCases), { symbol: "MISSING" }, "Pair not found"],
      [createTransactionsReadHandler(useCases), { id: "missing" }, "Transaction not found"],
      [
        createTransactionGroupsReadHandler(useCases),
        { id: "missing" },
        "Transaction group not found",
      ],
    ] as const;

    for (const [handler, query, message] of cases) {
      const response = createMockResponse();
      await handler(request("GET", query), response.response);
      assert.equal(response.statusCode, 404);
      assert.deepEqual(response.body, {
        error: { code: "NOT_FOUND", message: `${message}: ${Object.values(query)[0]}` },
      });
    }
  });

  test("read API csak GET-et engedélyez és egységes 405 választ ad", async () => {
    const response = createMockResponse();
    await createPairsReadHandler(createReadUseCases())(
      request("POST"),
      response.response
    );

    assert.equal(response.statusCode, 405);
    assert.equal(response.headers.Allow, "GET");
    assert.deepEqual(response.body, {
      error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" },
    });
  });

  test("repository hiba nem szivárog ki, hanem stabil 500 választ ad", async () => {
    const useCases = createReadUseCases();
    const handler = createTransactionsReadHandler({
      ...useCases,
      listTransactions: {
        execute: async () => {
          throw new Error("database details");
        },
      },
    });
    const response = createMockResponse();

    await handler(request(), response.response);

    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, {
      error: { code: "INTERNAL_ERROR", message: "Failed to read transactions" },
    });
  });

  test("API auth boundary 401-et ad token nélkül és továbbengedi az érvényes tokent", async () => {
    const handler = withAuth(createPairsReadHandler(createReadUseCases()));
    const unauthorized = createMockResponse();
    await handler(request(), unauthorized.response);
    assert.equal(unauthorized.statusCode, 401);
    assert.deepEqual(unauthorized.body, { error: "Unauthorized" });

    const authorized = createMockResponse();
    const authorizedRequest = request();
    authorizedRequest.headers.cookie = `token=${generateToken("reader@example.com")}`;
    await handler(authorizedRequest, authorized.response);
    assert.equal(authorized.statusCode, 200);
    assert.deepEqual(authorized.body, { data: [pair] });
  });

  test("write API-k mentik és törlik a pair, transaction és group DTO-kat", async () => {
    const saved: string[] = [];
    const pairWrites: Pick<PairRepository, "save" | "delete"> = {
      save: async (value) => void saved.push(`pair:${value.pair}`),
      delete: async (id) => void saved.push(`pair-delete:${id}`),
    };
    const transactionWrites: Pick<TransactionRepository, "save" | "saveMany"> = {
      save: async (value) => void saved.push(`transaction:${value.orderId}:${value.date instanceof Date}`),
      saveMany: async (values) => void saved.push(`transactions:${values.length}`),
    };
    const groupWrites: Pick<TransactionGroupRepository, "save" | "delete"> = {
      save: async (value) => void saved.push(`group:${value.groupId}:${value.groupedTrans[0].date instanceof Date}`),
      delete: async (id) => void saved.push(`group-delete:${id}`),
    };
    const useCases = createReadUseCases();
    const transactionDto = { ...transaction, date: transaction.date.toISOString() };
    const groupDto = { ...group, groupedTrans: [transactionDto] };
    const calls = [
      [createPairsReadHandler(useCases, pairWrites), request("PUT", { symbol: pair.pair }, pair)],
      [createPairsReadHandler(useCases, pairWrites), request("DELETE", { symbol: pair.pair })],
      [createTransactionsReadHandler(useCases, transactionWrites), request("PUT", { id: transaction.orderId }, transactionDto)],
      [createTransactionsReadHandler(useCases, transactionWrites), request("PUT", {}, [transactionDto])],
      [createTransactionGroupsReadHandler(useCases, groupWrites), request("PUT", { id: group.groupId! }, groupDto)],
      [createTransactionGroupsReadHandler(useCases, groupWrites), request("DELETE", { id: group.groupId! })],
    ] as const;

    for (const [handler, apiRequest] of calls) {
      const apiResponse = createMockResponse();
      await handler(apiRequest, apiResponse.response);
      assert.equal(apiResponse.statusCode, 200);
    }
    assert.deepEqual(saved, [
      "pair:SOLUSDC",
      "pair-delete:SOLUSDC",
      "transaction:tx-1:true",
      "transactions:1",
      "group:group-1:true",
      "group-delete:group-1",
    ]);
  });

  test("transaction epoch API GET és PUT műveleteket konzisztensen kezel", async () => {
    let epoch: number | null = 100;
    const handler = createTransactionEpochHandler({
      getLastProcessedEpoch: async () => epoch,
      setLastProcessedEpoch: async (_pair, _tradeType, value) => void (epoch = value),
    });
    const getResponse = createMockResponse();
    await handler(request("GET", { pair: "SOLUSDC", tradeType: TradeType.Spot }), getResponse.response);
    assert.deepEqual(getResponse.body, { data: 100 });

    const putResponse = createMockResponse();
    await handler(request("PUT", {}, { pair: "SOLUSDC", tradeType: TradeType.Spot, epoch: 200 }), putResponse.response);
    assert.equal(epoch, 200);
    assert.deepEqual(putResponse.body, { data: null });
  });

  test("write API hibás DTO-ra 400-at, repository hibára sanitizált 500-at ad", async () => {
    const badRequest = createMockResponse();
    await createPairsReadHandler(createReadUseCases(), { save: async () => {}, delete: async () => {} })(
      request("PUT", { symbol: "SOLUSDC" }, { pair: "OTHER" }),
      badRequest.response
    );
    assert.equal(badRequest.statusCode, 400);
    assert.deepEqual(badRequest.body, {
      error: { code: "BAD_REQUEST", message: "A valid pair matching the URL symbol is required" },
    });

    const serverError = createMockResponse();
    await createTransactionsReadHandler(createReadUseCases(), {
      save: async () => { throw new Error("database secret"); },
      saveMany: async () => {},
    })(request("PUT", { id: transaction.orderId }, { ...transaction, date: transaction.date.toISOString() }), serverError.response);
    assert.equal(serverError.statusCode, 500);
    assert.deepEqual(serverError.body, {
      error: { code: "INTERNAL_ERROR", message: "Failed to write transactions" },
    });
  });

  test("database health API csak GET-et enged és nem módosít adatot", async () => {
    let checks = 0;
    const handler = createDatabaseHealthHandler(async () => {
      checks += 1;
      return true;
    });
    const success = createMockResponse();
    await handler(request("GET"), success.response);
    assert.equal(checks, 1);
    assert.deepEqual(success.body, { data: { status: "ok" } });

    const rejected = createMockResponse();
    await handler(request("POST"), rejected.response);
    assert.equal(checks, 1);
    assert.equal(rejected.statusCode, 405);
    assert.equal(rejected.headers.Allow, "GET");
    assert.deepEqual(rejected.body, {
      error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" },
    });
  });

  test("database health API elrejti a kapcsolat belső hibáját", async () => {
    const handler = createDatabaseHealthHandler(async () => {
      throw new Error("redis host and password details");
    });
    const response = createMockResponse();
    await handler(request("GET"), response.response);

    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.body, {
      error: {
        code: "INTERNAL_ERROR",
        message: "Database connection unavailable",
      },
    });
  });

  test("Binance health API alap kapcsolatadatokat és csak elérhető spot balance-okat ad vissza", async () => {
    const handler = createBinanceHealthHandler({
      ping: async () => true,
      time: async () => 1_725_000_000_000,
      accountInfo: async () =>
        ({
          accountType: "SPOT",
          canTrade: true,
          balances: [
            { asset: "USDC", free: "125.50", locked: "10" },
            { asset: "BTC", free: "0.002", locked: "0" },
            { asset: "ETH", free: "0", locked: "1" },
          ],
        } as Account),
    });
    const response = createMockResponse();

    await handler(request("GET"), response.response);

    assert.equal(response.statusCode, 200);
    assert.deepEqual((response.body as any).data.balances, [
      { asset: "BTC", free: "0.002" },
      { asset: "USDC", free: "125.50" },
    ]);
    assert.equal((response.body as any).data.accountType, "SPOT");
    assert.equal((response.body as any).data.canTrade, true);
    assert.equal((response.body as any).data.serverTime, 1_725_000_000_000);
    assert.equal(typeof (response.body as any).data.latencyMs, "number");
  });

  test("Binance health API elutasítja a nem GET kérést és elrejti a klienshibát", async () => {
    let calls = 0;
    const handler = createBinanceHealthHandler({
      ping: async () => {
        calls += 1;
        throw new Error("API secret and upstream details");
      },
      time: async () => 0,
      accountInfo: async () => ({}) as Account,
    });

    const rejected = createMockResponse();
    await handler(request("POST"), rejected.response);
    assert.equal(rejected.statusCode, 405);
    assert.equal(rejected.headers.Allow, "GET");
    assert.equal(calls, 0);

    const unavailable = createMockResponse();
    await handler(request("GET"), unavailable.response);
    assert.equal(unavailable.statusCode, 503);
    assert.deepEqual(unavailable.body, {
      error: {
        code: "INTERNAL_ERROR",
        message: "Binance API connection unavailable",
      },
    });
  });
});

describe("Binance API SDK migration contracts", () => {
  type BinanceClient = typeof binanceClient;
  type LegacyBinanceClient = ReturnType<typeof Binance>;
  type SpotRestApi = Parameters<typeof createBinanceClient>[0];
  const sdkResponse = <T>(value: T) => ({ data: async () => value });

  test("a compatibility facade megtartja a szerveridőt és a legacy order defaultot", async () => {
    const calls: unknown[] = [];
    const client = createBinanceClient({
      time: async () => sdkResponse({ serverTime: 123456 }),
      newOrder: async (options: unknown) => {
        calls.push(options);
        return sdkResponse({ orderId: 42 });
      },
    } as unknown as SpotRestApi);

    await client.order({
      symbol: "SOLUSDC",
      side: "SELL",
      type: "STOP_LOSS_LIMIT",
      quantity: "1",
      price: "150",
      stopPrice: "149",
      useServerTime: true,
    });

    assert.deepEqual(calls, [
      {
        symbol: "SOLUSDC",
        side: "SELL",
        type: "STOP_LOSS_LIMIT",
        quantity: "1",
        price: "150",
        stopPrice: "149",
        timeInForce: "GTC",
        timestamp: 123456,
      },
    ]);
  });

  test("a compatibility facade a legacy candle volume mezőket állítja elő", async () => {
    const client = createBinanceClient({
      klines: async () =>
        sdkResponse([
          [
            1,
            "2",
            "3",
            "4",
            "5",
            "6",
            7,
            "quote-volume",
            9,
            "base-volume",
            "quote-asset-volume",
          ],
        ]),
    } as unknown as SpotRestApi);

    const [candle] = await client.candles({ symbol: "SOLUSDC", interval: "1h" });

    assert.equal(candle.quoteVolume, "quote-volume");
    assert.equal(candle.baseAssetVolume, "base-volume");
    assert.equal(candle.quoteAssetVolume, "quote-asset-volume");
  });

  test("Spot all-orders változatlan paraméterekkel és válasszal működik", async () => {
    const calls: unknown[] = [];
    const orders = [{ orderId: 42, symbol: "SOLUSDC", status: "FILLED" }];
    const handler = createSpotHandler({
      allOrders: async (options: unknown) => {
        calls.push(options);
        return orders;
      },
    } as unknown as BinanceClient);
    const response = createMockResponse();

    await handler(request("GET", { action: "AllOrders", symbol: "SOLUSDC" }), response.response);

    assert.deepEqual(calls, [{ symbol: "SOLUSDC", useServerTime: true }]);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, orders);
  });

  test("Spot order létrehozás és törlés megőrzi a request mezőket", async () => {
    const calls: unknown[] = [];
    const client = {
      order: async (options: unknown) => {
        calls.push(["order", options]);
        return { orderId: 43 };
      },
      cancelOrder: async (options: unknown) => {
        calls.push(["cancel", options]);
        return { orderId: 43, status: "CANCELED" };
      },
    } as unknown as BinanceClient;
    const handler = createSpotHandler(client);
    const order = {
      symbol: "SOLUSDC",
      side: "SELL",
      type: "STOP_LOSS_LIMIT",
      quantity: "1.25",
      price: "150",
      stopPrice: "149",
    };
    const created = createMockResponse();
    await handler(request("POST", {}, order), created.response);
    const canceled = createMockResponse();
    await handler(request("DELETE", {}, { symbol: "SOLUSDC", orderId: 43 }), canceled.response);

    assert.deepEqual(calls, [
      ["order", { ...order, useServerTime: true }],
      ["cancel", { symbol: "SOLUSDC", orderId: 43, useServerTime: true }],
    ]);
    assert.deepEqual(created.body, { orderId: 43 });
    assert.deepEqual(canceled.body, { orderId: 43, status: "CANCELED" });
  });

  test("Margin all-orders a symbolt továbbítja és változatlan listát ad vissza", async () => {
    const calls: unknown[] = [];
    const orders = [{ orderId: 44, symbol: "BTCUSDC", status: "NEW" }];
    const handler = createMarginHandler({
      marginAllOrders: async (options: unknown) => {
        calls.push(options);
        return orders;
      },
    } as unknown as LegacyBinanceClient);
    const response = createMockResponse();

    await handler(request("GET", { action: "AllOrders", symbol: "BTCUSDC" }), response.response);

    assert.deepEqual(calls, [{ symbol: "BTCUSDC", useServerTime: true }]);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, orders);
  });

  test("Margin order létrehozás és törlés megőrzi a request mezőket", async () => {
    const calls: unknown[] = [];
    const client = {
      marginOrder: async (options: unknown) => {
        calls.push(["order", options]);
        return { orderId: 45 };
      },
      marginCancelOrder: async (options: unknown) => {
        calls.push(["cancel", options]);
        return { orderId: 45, status: "CANCELED" };
      },
    } as unknown as LegacyBinanceClient;
    const handler = createMarginHandler(client);
    const order = {
      symbol: "BTCUSDC",
      side: "BUY",
      type: "LIMIT",
      quantity: "0.01",
      price: "50000",
    };
    const created = createMockResponse();
    await handler(request("POST", {}, order), created.response);
    const canceled = createMockResponse();
    await handler(request("DELETE", {}, { symbol: "BTCUSDC", orderId: 45 }), canceled.response);

    assert.deepEqual(calls, [
      ["order", { ...order, useServerTime: true }],
      ["cancel", { symbol: "BTCUSDC", orderId: 45, useServerTime: true }],
    ]);
    assert.deepEqual(created.body, { orderId: 45 });
    assert.deepEqual(canceled.body, { orderId: 45, status: "CANCELED" });
  });

  test("Spot és Margin írás nem hív SDK-t hiányos order esetén", async () => {
    let calls = 0;
    const spotClient = {
      order: async () => void (calls += 1),
    } as unknown as BinanceClient;
    const marginClient = {
      marginOrder: async () => void (calls += 1),
    } as unknown as LegacyBinanceClient;

    for (const handler of [
      createSpotHandler(spotClient),
      createMarginHandler(marginClient),
    ]) {
      const response = createMockResponse();
      await handler(request("POST", {}, { symbol: "SOLUSDC" }), response.response);
      assert.equal(response.statusCode, 400);
      assert.match(String((response.body as { error: string }).error), /parameters missing/i);
    }
    assert.equal(calls, 0);
  });
});
