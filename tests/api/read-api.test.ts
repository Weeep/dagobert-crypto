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
import type {
  DagobertTransactionGroup,
  TransactionGroupRepository,
} from "@/src/modules/transaction-group";
import { createTransactionGroupsReadHandler } from "@/src/modules/transaction-group/infrastructure/http/transactionGroupsReadHandler";
import { createUseCases } from "@/src/shared/composition/createUseCases";
import { generateToken, withAuth } from "@/utils/auth";

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

function request(method = "GET", query: NextApiRequest["query"] = {}): NextApiRequest {
  return { method, query, headers: {} } as NextApiRequest;
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
});
