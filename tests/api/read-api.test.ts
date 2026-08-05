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
import { selectDataSourceHandler } from "@/src/shared/infrastructure/http/selectDataSourceHandler";

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
});

test("data source selector uses PostgreSQL only for opted-in GET requests", async () => {
  const selected: string[] = [];
  const handler = selectDataSourceHandler(
    async () => { selected.push("redis"); },
    async () => { selected.push("postgres"); }
  );
  const response = createMockResponse().response;

  const postgresGet = request("GET");
  postgresGet.headers["x-dagobert-data-source"] = "postgres";
  const postgresPut = request("PUT");
  postgresPut.headers["x-dagobert-data-source"] = "postgres";

  await handler(postgresGet, response);
  await handler(postgresPut, response);
  await handler(request("GET"), response);

  const pairWriteHandler = selectDataSourceHandler(
    async () => { selected.push("redis-pair-write"); },
    async () => { selected.push("postgres-pair-write"); },
    { postgresWritesEnabled: true }
  );
  await pairWriteHandler(postgresPut, response);

  assert.deepEqual(selected, [
    "postgres",
    "redis",
    "redis",
    "postgres-pair-write",
  ]);
});
