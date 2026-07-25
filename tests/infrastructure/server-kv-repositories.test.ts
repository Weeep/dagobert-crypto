import test, { describe } from "node:test";
import assert from "node:assert/strict";

import type { DagobertPair } from "@/src/modules/pair";
import { KvPairRepository } from "@/src/modules/pair/infrastructure/kv/KvPairRepository";
import type { DagobertTransaction } from "@/src/modules/transaction";
import { TradeStyle, TradeType } from "@/src/modules/transaction";
import { KvTransactionRepository } from "@/src/modules/transaction/infrastructure/kv/KvTransactionRepository";
import type { DagobertTransactionGroup } from "@/src/modules/transaction-group";
import { KvTransactionGroupRepository } from "@/src/modules/transaction-group/infrastructure/kv/KvTransactionGroupRepository";
import { createServerUseCases } from "@/src/shared/composition/createServerUseCases";
import type { KeyValueStore } from "@/src/shared/infrastructure/kv/KeyValueStore";
import { KVRoot } from "@/src/shared/infrastructure/kv/KVRoot";

class InMemoryKeyValueStore implements KeyValueStore {
  readonly strings = new Map<string, string | number>();
  readonly hashes = new Map<KVRoot, Record<string, unknown>>();

  async get(key: string): Promise<string | number | null> {
    return this.strings.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.strings.set(key, value);
  }

  async hget(key: KVRoot, field: string): Promise<unknown> {
    return this.hashes.get(key)?.[field] ?? null;
  }

  async hgetall(key: KVRoot): Promise<Record<string, unknown>> {
    return this.hashes.get(key) ?? {};
  }

  async hset(key: KVRoot, value: Record<string, unknown>): Promise<void> {
    this.hashes.set(key, { ...(this.hashes.get(key) ?? {}), ...value });
  }

  async hdel(key: string, field: string): Promise<void> {
    const hash = this.hashes.get(key as KVRoot);
    if (hash) delete hash[field];
  }
}

const makeTransaction = (
  overrides: Partial<DagobertTransaction> = {}
): DagobertTransaction => ({
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

describe("server-side KV repository szerződések", () => {
  test("pair repository közvetlenül a szerveroldali store-ból olvas és oda ír", async () => {
    const store = new InMemoryKeyValueStore();
    const repository = new KvPairRepository(store);
    const pair: DagobertPair = { pair: "SOLUSDC", decimals: 4, keyLevels: [100] };

    assert.deepEqual(await repository.findAll(), []);
    assert.equal(await repository.findBySymbol("SOLUSDC"), null);
    await repository.save(pair);
    assert.deepEqual(await repository.findBySymbol("SOLUSDC"), pair);
    assert.deepEqual(await repository.findAll(), [pair]);
    await repository.delete("SOLUSDC");
    assert.equal(await repository.findBySymbol("SOLUSDC"), null);
  });

  test("transaction repository támogatja az egyedi és batch mentést, valamint az epochot", async () => {
    const store = new InMemoryKeyValueStore();
    const repository = new KvTransactionRepository(store);
    const first = makeTransaction();
    const second = makeTransaction({ orderId: "tx-2" });

    await repository.save(first);
    await repository.saveMany([second]);
    await repository.saveMany([]);
    assert.deepEqual(await repository.findAll(), [first, second]);
    assert.deepEqual(await repository.findById("tx-2"), second);
    assert.equal(await repository.findById("missing"), null);
    assert.equal(await repository.getLastProcessedEpoch("SOLUSDC", TradeType.Spot), null);
    await repository.setLastProcessedEpoch("SOLUSDC", TradeType.Spot, 1234);
    assert.equal(await repository.getLastProcessedEpoch("SOLUSDC", TradeType.Spot), 1234);
  });

  test("transaction-group repository CRUD-ja és groupId validációja szerveroldalon működik", async () => {
    const store = new InMemoryKeyValueStore();
    const repository = new KvTransactionGroupRepository(store);
    const transaction = makeTransaction({ grouped: true });
    const group: DagobertTransactionGroup = {
      groupId: "group-1",
      pair: "SOLUSDC",
      amount: transaction.amount,
      executed: transaction.executed,
      tradeType: transaction.tradeType,
      lastTransDateEpoch: transaction.dateEpoch,
      groupedTrans: [transaction],
      note: "",
    };

    await repository.save(group);
    assert.deepEqual(await repository.findById("group-1"), group);
    assert.deepEqual(await repository.findAll(), [group]);
    await repository.delete("group-1");
    assert.equal(await repository.findById("group-1"), null);
    await assert.rejects(repository.save({ ...group, groupId: null }), /without groupId/);
  });

  test("server composition root ugyanazokat a use case-eket KV adapterekkel köti be", async () => {
    const store = new InMemoryKeyValueStore();
    const useCases = createServerUseCases(store);

    const createResult = await useCases.createPair.execute({ pair: "solusdc" });

    assert.equal(createResult.ok, true);
    assert.deepEqual(await useCases.listPairs.execute(), [
      { pair: "SOLUSDC", decimals: 4, keyLevels: [] },
    ]);
  });
});
