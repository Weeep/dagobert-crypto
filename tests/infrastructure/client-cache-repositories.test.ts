import test, { describe } from "node:test";
import assert from "node:assert/strict";

import ClientSideDbCache from "@/app/lib/ClientSideDbCache";
import type { DagobertPair } from "@/src/modules/pair";
import { ClientCachePairRepository } from "@/src/modules/pair/infrastructure/client-cache/ClientCachePairRepository";
import type { DagobertTransaction } from "@/src/modules/transaction";
import { TradeStyle, TradeType } from "@/src/modules/transaction";
import { ClientCacheTransactionRepository } from "@/src/modules/transaction/infrastructure/client-cache/ClientCacheTransactionRepository";
import type { DagobertTransactionGroup } from "@/src/modules/transaction-group";
import { ClientCacheTransactionGroupRepository } from "@/src/modules/transaction-group/infrastructure/client-cache/ClientCacheTransactionGroupRepository";
import { KVRoot } from "@/src/shared/infrastructure/kv/KVRoot";

type CacheInternals = { cache: Record<string, any>; isInitialized: boolean };
const cacheInternals = ClientSideDbCache as unknown as CacheInternals;
const originalFetch = globalThis.fetch;

const makeTransaction = (overrides: Partial<DagobertTransaction> = {}): DagobertTransaction => ({
  orderId: "tx-1",
  binanceApiId: 1,
  pair: "SOLUSDC",
  amount: -50,
  executed: 0.5,
  date: new Date(Date.UTC(2025, 0, 2)),
  dateEpoch: Date.UTC(2025, 0, 2),
  side: "BUY",
  price: 100,
  status: "FILLED",
  grouped: false,
  note: "",
  otherSideOrderId: "",
  tradeType: TradeType.Spot,
  tradeStyle: TradeStyle.Swing,
  ...overrides,
});

describe("kliensoldali cache repository szerződések", { concurrency: false }, () => {
  test.beforeEach(() => {
    cacheInternals.cache = {
      [KVRoot.pairs]: {},
      [KVRoot.dtransactions]: {},
      [KVRoot.dtransactionGroups]: {},
    };
    cacheInternals.isInitialized = true;
    globalThis.fetch = (async () => new Response("{}", { status: 200 })) as typeof fetch;
  });

  test.afterEach(() => {
    globalThis.fetch = originalFetch;
    cacheInternals.cache = {};
    cacheInternals.isInitialized = false;
  });

test("pair cache repository teljes CRUD contractja megmarad", async () => {
  const repository = new ClientCachePairRepository();
  const sol: DagobertPair = { pair: "SOLUSDC", decimals: 4, keyLevels: [100] };
  const btc: DagobertPair = { pair: "BTCUSDC", decimals: 2, keyLevels: [] };

  assert.deepEqual(await repository.findAll(), []);
  assert.equal(await repository.findBySymbol("SOLUSDC"), null);
  await repository.save(sol);
  await repository.save(btc);
  assert.deepEqual(await repository.findBySymbol("SOLUSDC"), sol);
  assert.deepEqual(await repository.findAll(), [sol, btc]);
  await repository.delete("SOLUSDC");
  assert.equal(await repository.findBySymbol("SOLUSDC"), null);
  assert.deepEqual(await repository.findAll(), [btc]);
});

test("transaction cache repository save/saveMany/read és epoch contractja megmarad", async () => {
  const repository = new ClientCacheTransactionRepository();
  const first = makeTransaction({ orderId: "tx-1" });
  const second = makeTransaction({ orderId: "tx-2", pair: "BTCUSDC" });
  const third = makeTransaction({ orderId: "tx-3", tradeType: TradeType.Margin });

  assert.equal(await repository.findById("missing"), null);
  assert.equal(await repository.getLastProcessedEpoch("SOLUSDC", TradeType.Spot), null);
  await repository.save(first);
  await repository.saveMany([second, third]);
  assert.deepEqual(await repository.findById("tx-2"), second);
  assert.deepEqual(await repository.findAll(), [first, second, third]);
  await repository.saveMany([]);
  assert.deepEqual(await repository.findAll(), [first, second, third]);

  await repository.setLastProcessedEpoch("SOLUSDC", TradeType.Spot, 123456);
  assert.equal(await repository.getLastProcessedEpoch("SOLUSDC", TradeType.Spot), 123456);
});

test("transaction group cache repository teljes CRUD contractja és groupId validációja megmarad", async () => {
  const repository = new ClientCacheTransactionGroupRepository();
  const transaction = makeTransaction({ grouped: true });
  const group: DagobertTransactionGroup = {
    groupId: "group-1",
    pair: "SOLUSDC",
    amount: -50,
    executed: 0.5,
    tradeType: TradeType.Spot,
    lastTransDateEpoch: transaction.dateEpoch,
    groupedTrans: [transaction],
    note: "",
  };

  assert.deepEqual(await repository.findAll(), []);
  assert.equal(await repository.findById("missing"), null);
  await repository.save(group);
  assert.deepEqual(await repository.findById("group-1"), group);
  assert.deepEqual(await repository.findAll(), [group]);
  await repository.delete("group-1");
  assert.equal(await repository.findById("group-1"), null);

  await assert.rejects(
    repository.save({ ...group, groupId: null }),
    /Cannot save transaction group without groupId/
  );
});
});
