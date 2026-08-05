import test, { describe } from "node:test";
import assert from "node:assert/strict";

import type { DagobertPair } from "@/src/modules/pair";
import { HttpPairRepository } from "@/src/modules/pair/infrastructure/http/HttpPairRepository";
import type {
  DagobertTransaction,
} from "@/src/modules/transaction";
import { TradeStyle, TradeType } from "@/src/modules/transaction";
import type { TransactionDto } from "@/src/modules/transaction/dto/TransactionDto";
import { HttpTransactionRepository } from "@/src/modules/transaction/infrastructure/http/HttpTransactionRepository";
import type {
  DagobertTransactionGroup,
} from "@/src/modules/transaction-group";
import type { TransactionGroupDto } from "@/src/modules/transaction-group/dto/TransactionGroupDto";
import { HttpTransactionGroupRepository } from "@/src/modules/transaction-group/infrastructure/http/HttpTransactionGroupRepository";
import { createClientUseCases } from "@/src/shared/composition/clientUseCases";
import {
  HttpReadClient,
  HttpReadError,
  type FetchLike,
} from "@/src/shared/infrastructure/http/HttpReadClient";
import { HttpWriteClient } from "@/src/shared/infrastructure/http/HttpWriteClient";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function fetchRouter(routes: Record<string, Response>): {
  fetch: FetchLike;
  requests: Array<{ url: string; method: string | undefined; body?: string }>;
} {
  const requests: Array<{ url: string; method: string | undefined; body?: string }> = [];
  return {
    requests,
    fetch: (async (input: string | URL | Request, init?: RequestInit) => {
      const url = input.toString();
      requests.push({
        url,
        method: init?.method,
        ...(typeof init?.body === "string" ? { body: init.body } : {}),
      });
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

const unusedWrites = new HttpWriteClient(async () => {
  throw new Error("Unexpected write request");
});

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
      unusedWrites
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
      unusedWrites
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
      unusedWrites
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
      unusedWrites
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

  test("a böngésző natív fetch függvényét globalThis kontextussal hívja", async () => {
    const browserFetch = async function (
      this: unknown,
      input: string | URL | Request
    ): Promise<Response> {
      if (this !== globalThis) {
        throw new TypeError("Illegal invocation");
      }

      assert.equal(input.toString(), "/api/pairs");
      return response({ data: [pair] });
    } as FetchLike;
    const useCases = createClientUseCases(browserFetch);

    assert.deepEqual(await useCases.listPairs.execute(), [pair]);
  });

  test("HTTP read és write kliensek adatforrás-kapcsoló header nélkül hívják az API-t", async () => {
    const requests: Array<{
      url: string;
      method: string | undefined;
      dataSource: string | null;
    }> = [];
    const fetchImplementation = (async (
      input: string | URL | Request,
      init?: RequestInit
    ) => {
      const headers = new Headers(init?.headers);
      requests.push({
        url: input.toString(),
        method: init?.method,
        dataSource: headers.get("X-Dagobert-Data-Source"),
      });
      return response({ data: init?.method === "GET" ? [] : null });
    }) as FetchLike;

    await new HttpReadClient(fetchImplementation).get("/api/transactions");
    await new HttpWriteClient(fetchImplementation).put(
      "/api/transactions/tx-1",
      transactionDto
    );
    await new HttpWriteClient(fetchImplementation).delete("/api/pairs/SOLUSDC");

    assert.deepEqual(requests, [
      { url: "/api/transactions", method: "GET", dataSource: null },
      { url: "/api/transactions/tx-1", method: "PUT", dataSource: null },
      { url: "/api/pairs/SOLUSDC", method: "DELETE", dataSource: null },
    ]);
  });

  test("a kliens composition root minden repository írást HTTP API-ra küld", async () => {
    const epochUrl = "/api/transactions/last-processed-epoch?pair=SOLUSDC&tradeType=spot";
    const router = fetchRouter({
      "/api/pairs/SOL%2FUSDC": response({ data: pair }),
      "/api/transactions/tx%2Fid": response({ data: transactionDto }),
      "/api/transactions": response({ data: null }),
      [epochUrl]: response({ data: 123 }),
      "/api/transactions/last-processed-epoch": response({ data: null }),
      "/api/transaction-groups/group%2Fid": response({ data: groupDto }),
    });
    const writes = new HttpWriteClient(router.fetch);
    const pairRepository = new HttpPairRepository(new HttpReadClient(router.fetch), writes);
    const transactionRepository = new HttpTransactionRepository(new HttpReadClient(router.fetch), writes);
    const groupRepository = new HttpTransactionGroupRepository(new HttpReadClient(router.fetch), writes);

    await pairRepository.save(pair);
    await pairRepository.delete(pair.pair);
    await transactionRepository.save(transaction);
    await transactionRepository.saveMany([transaction]);
    assert.equal(await transactionRepository.getLastProcessedEpoch("SOLUSDC", TradeType.Spot), 123);
    await transactionRepository.setLastProcessedEpoch("SOLUSDC", TradeType.Spot, 456);
    await groupRepository.save({ ...groupDto, groupedTrans: [transaction] });
    await groupRepository.delete("group/id");

    assert.deepEqual(router.requests.map(({ url, method }) => ({ url, method })), [
      { url: "/api/pairs/SOL%2FUSDC", method: "PUT" },
      { url: "/api/pairs/SOL%2FUSDC", method: "DELETE" },
      { url: "/api/transactions/tx%2Fid", method: "PUT" },
      { url: "/api/transactions", method: "PUT" },
      { url: epochUrl, method: "GET" },
      { url: "/api/transactions/last-processed-epoch", method: "PUT" },
      { url: "/api/transaction-groups/group%2Fid", method: "PUT" },
      { url: "/api/transaction-groups/group%2Fid", method: "DELETE" },
    ]);
  });

  test("HTTP write hiba státusszal és sanitizált API üzenettel továbbterjed", async () => {
    const writes = new HttpWriteClient(fetchRouter({
      "/api/pairs/SOL%2FUSDC": response(
        { error: { code: "INTERNAL_ERROR", message: "Failed to write pair" } },
        500
      ),
    }).fetch);

    await assert.rejects(
      new HttpPairRepository(new HttpReadClient(), writes).save(pair),
      (error: unknown) => error instanceof HttpReadError &&
        error.status === 500 && error.message === "Failed to write pair"
    );
  });
});
