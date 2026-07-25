import test, { describe } from "node:test";
import assert from "node:assert/strict";

import type { DagobertPair, PairRepository } from "@/src/modules/pair";
import { HttpPairRepository } from "@/src/modules/pair/infrastructure/http/HttpPairRepository";
import type {
  DagobertTransaction,
  TransactionRepository,
} from "@/src/modules/transaction";
import { TradeStyle, TradeType } from "@/src/modules/transaction";
import type { TransactionDto } from "@/src/modules/transaction/dto/TransactionDto";
import { HttpTransactionRepository } from "@/src/modules/transaction/infrastructure/http/HttpTransactionRepository";
import type {
  DagobertTransactionGroup,
  TransactionGroupRepository,
} from "@/src/modules/transaction-group";
import type { TransactionGroupDto } from "@/src/modules/transaction-group/dto/TransactionGroupDto";
import { HttpTransactionGroupRepository } from "@/src/modules/transaction-group/infrastructure/http/HttpTransactionGroupRepository";
import { createClientUseCases } from "@/src/shared/composition/clientUseCases";
import {
  HttpReadClient,
  HttpReadError,
  type FetchLike,
} from "@/src/shared/infrastructure/http/HttpReadClient";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function fetchRouter(routes: Record<string, Response>): {
  fetch: FetchLike;
  requests: Array<{ url: string; method: string | undefined }>;
} {
  const requests: Array<{ url: string; method: string | undefined }> = [];
  return {
    requests,
    fetch: (async (input: string | URL | Request, init?: RequestInit) => {
      const url = input.toString();
      requests.push({ url, method: init?.method });
      return (
        routes[url]?.clone() ??
        response({ error: { message: "missing test route" } }, 500)
      );
    }) as FetchLike,
  };
}

const pair: DagobertPair = { pair: "SOL/USDC", decimals: 4, keyLevels: [100] };
const transactionDto: TransactionDto = {
  orderId: "tx/id",
  binanceApiId: 1,
  pair: "SOLUSDC",
  amount: -50,
  executed: 0.5,
  date: "2025-01-02T12:00:00.000Z",
  dateEpoch: Date.parse("2025-01-02T12:00:00.000Z"),
  side: "BUY",
  price: 100,
  status: "FILLED",
  grouped: true,
  note: "",
  otherSideOrderId: "",
  tradeType: TradeType.Spot,
  tradeStyle: TradeStyle.Swing,
};
const transaction: DagobertTransaction = {
  ...transactionDto,
  date: new Date(transactionDto.date),
};
const groupDto: TransactionGroupDto = {
  groupId: "group/id",
  pair: "SOLUSDC",
  amount: -50,
  executed: 0.5,
  tradeType: TradeType.Spot,
  lastTransDateEpoch: transaction.dateEpoch,
  groupedTrans: [transactionDto],
  note: "",
};

const pairWrites: Pick<PairRepository, "save" | "delete"> = {
  save: async () => {},
  delete: async () => {},
};
const transactionWrites: Pick<
  TransactionRepository,
  "save" | "saveMany" | "getLastProcessedEpoch" | "setLastProcessedEpoch"
> = {
  save: async () => {},
  saveMany: async () => {},
  getLastProcessedEpoch: async () => null,
  setLastProcessedEpoch: async () => {},
};
const groupWrites: Pick<TransactionGroupRepository, "save" | "delete"> = {
  save: async () => {},
  delete: async () => {},
};

describe("HTTP read repositoryk", () => {
  test("pair list/get az API-ból olvas, URL-t kódol, a 404-et pedig nullra képezi", async () => {
    const router = fetchRouter({
      "/api/pairs": response({ data: [pair] }),
      "/api/pairs/SOL%2FUSDC": response({ data: pair }),
      "/api/pairs/MISSING": response(
        { error: { code: "NOT_FOUND", message: "Pair not found" } },
        404
      ),
    });
    const repository = new HttpPairRepository(
      new HttpReadClient(router.fetch),
      pairWrites
    );

    assert.deepEqual(await repository.findAll(), [pair]);
    assert.deepEqual(await repository.findBySymbol(" sol/usdc "), pair);
    assert.equal(await repository.findBySymbol("missing"), null);
    assert.deepEqual(router.requests, [
      { url: "/api/pairs", method: "GET" },
      { url: "/api/pairs/SOL%2FUSDC", method: "GET" },
      { url: "/api/pairs/MISSING", method: "GET" },
    ]);
  });

  test("transaction list/get az API DTO dátumát Date objektummá alakítja", async () => {
    const router = fetchRouter({
      "/api/transactions": response({ data: [transactionDto] }),
      "/api/transactions/tx%2Fid": response({ data: transactionDto }),
    });
    const repository = new HttpTransactionRepository(
      new HttpReadClient(router.fetch),
      transactionWrites
    );

    assert.deepEqual(await repository.findAll(), [transaction]);
    assert.deepEqual(await repository.findById("tx/id"), transaction);
    assert.ok((await repository.findById("tx/id"))?.date instanceof Date);
  });

  test("group list/get a nested transaction dátumát is visszaalakítja", async () => {
    const router = fetchRouter({
      "/api/transaction-groups": response({ data: [groupDto] }),
      "/api/transaction-groups/group%2Fid": response({ data: groupDto }),
    });
    const repository = new HttpTransactionGroupRepository(
      new HttpReadClient(router.fetch),
      groupWrites
    );

    const groups = await repository.findAll();
    assert.ok(groups[0].groupedTrans[0].date instanceof Date);
    assert.deepEqual(await repository.findById("group/id"), groups[0]);
  });

  test("nem-404 API hiba státusszal és sanitizált API üzenettel továbbterjed", async () => {
    const repository = new HttpPairRepository(
      new HttpReadClient(
        fetchRouter({
          "/api/pairs": response(
            { error: { code: "INTERNAL_ERROR", message: "Failed to read pairs" } },
            500
          ),
        }).fetch
      ),
      pairWrites
    );

    await assert.rejects(repository.findAll(), (error: unknown) => {
      assert.ok(error instanceof HttpReadError);
      assert.equal(error.status, 500);
      assert.equal(error.message, "Failed to read pairs");
      return true;
    });
  });

  test("client composition root entity readjei HTTP repositorykon mennek át", async () => {
    const router = fetchRouter({
      "/api/pairs": response({ data: [pair] }),
      "/api/transactions": response({ data: [transactionDto] }),
      "/api/transaction-groups": response({ data: [groupDto] }),
    });
    const useCases = createClientUseCases(router.fetch);

    const [pairs, transactions, groups] = await Promise.all([
      useCases.listPairs.execute(),
      useCases.listTransactions.execute(),
      useCases.listTransactionGroups.execute(),
    ]);

    assert.deepEqual(pairs, [pair]);
    assert.deepEqual(transactions, [transaction]);
    assert.equal(groups[0].groupId, groupDto.groupId);
    assert.deepEqual(
      router.requests.map(({ url }) => url).sort(),
      ["/api/pairs", "/api/transaction-groups", "/api/transactions"]
    );
  });
});
