import test from "node:test";
import assert from "node:assert/strict";

import type { DagobertPair, PairRepository } from "@/src/modules/pair";
import {
  CreatePairUseCase,
  CreatePairsFromTransactionsUseCase,
  DeletePairUseCase,
  ListPairsUseCase,
  UpdatePairSettingsUseCase,
} from "@/src/modules/pair";
import type { DagobertTransaction, TransactionRepository } from "@/src/modules/transaction";
import { TradeStyle, TradeType } from "@/src/modules/transaction";

const makeTransaction = (
  overrides: Partial<DagobertTransaction>
): DagobertTransaction => ({
  orderId: "tx-1",
  binanceApiId: 1,
  pair: "SOLUSDC",
  amount: -50,
  executed: 0.5,
  date: new Date(Date.UTC(2025, 0, 2, 12, 0, 0)),
  dateEpoch: Date.UTC(2025, 0, 2, 12, 0, 0),
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

test("pair use case-ek listázzák, létrehozzák, módosítják és törlik a paireket repository boundaryn keresztül", async () => {
  const repository = makeInMemoryPairRepository([
    { pair: "BTCUSDC", decimals: 2, keyLevels: [100000] },
  ]);

  const createResult = await new CreatePairUseCase(repository).execute({
    pair: " solusdc ",
    keyLevels: [120, Number.NaN, 100],
  });
  assert.equal(createResult.ok, true);
  assert.deepEqual(createResult.pair, {
    pair: "SOLUSDC",
    decimals: 4,
    keyLevels: [120, 100],
  });

  const duplicateResult = await new CreatePairUseCase(repository).execute({
    pair: "SOLUSDC",
  });
  assert.equal(duplicateResult.ok, false);
  assert.match(duplicateResult.error, /already exists/);

  const listResult = await new ListPairsUseCase(repository).execute();
  assert.deepEqual(
    listResult.map((pair) => pair.pair),
    ["BTCUSDC", "SOLUSDC"]
  );

  const updateResult = await new UpdatePairSettingsUseCase(repository).execute({
    pair: "solusdc",
    decimals: 6,
    keyLevels: [90, Number.POSITIVE_INFINITY, 110],
  });
  assert.equal(updateResult.ok, true);
  assert.deepEqual(updateResult.pair, {
    pair: "SOLUSDC",
    decimals: 6,
    keyLevels: [90, 110],
  });

  const deleteResult = await new DeletePairUseCase(repository).execute("btcusdc");
  assert.equal(deleteResult.ok, true);

  const pairsAfterDelete = await new ListPairsUseCase(repository).execute();
  assert.deepEqual(
    pairsAfterDelete.map((pair) => pair.pair),
    ["SOLUSDC"]
  );
});

test("CreatePairsFromTransactionsUseCase hiányzó paireket hoz létre tranzakciók alapján, meglévőket kihagy", async () => {
  const pairRepository = makeInMemoryPairRepository([
    { pair: "SOLUSDC", decimals: 4, keyLevels: [100] },
  ]);
  const transactionRepository = makeInMemoryTransactionRepository([
    makeTransaction({ orderId: "tx-1", pair: " solusdc " }),
    makeTransaction({ orderId: "tx-2", pair: "BTCUSDC" }),
    makeTransaction({ orderId: "tx-3", pair: "ETHUSDC" }),
    makeTransaction({ orderId: "tx-4", pair: "BTCUSDC" }),
  ]);

  const result = await new CreatePairsFromTransactionsUseCase(
    pairRepository,
    transactionRepository
  ).execute();

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.createdPairs.map((pair) => pair.pair),
    ["BTCUSDC", "ETHUSDC"]
  );
  assert.deepEqual(
    result.skippedPairs.map((pair) => pair.pair),
    ["SOLUSDC"]
  );

  const allPairs = await new ListPairsUseCase(pairRepository).execute();
  assert.deepEqual(
    allPairs.map((pair) => pair.pair),
    ["BTCUSDC", "ETHUSDC", "SOLUSDC"]
  );
});

function makeInMemoryPairRepository(seed: DagobertPair[]): PairRepository {
  const pairs = new Map(seed.map((pair) => [pair.pair, pair]));

  return {
    findAll: async () => Array.from(pairs.values()),
    findBySymbol: async (symbol: string) => pairs.get(symbol.trim().toUpperCase()) ?? null,
    save: async (pair: DagobertPair) => {
      pairs.set(pair.pair, pair);
    },
    delete: async (symbol: string) => {
      pairs.delete(symbol.trim().toUpperCase());
    },
  };
}

function makeInMemoryTransactionRepository(
  seed: DagobertTransaction[]
): TransactionRepository {
  return {
    findAll: async () => seed,
    findById: async (id: string) =>
      seed.find((transaction) => transaction.orderId === id) ?? null,
    save: async () => {},
    saveMany: async () => {},
    getLastProcessedEpoch: async () => null,
    setLastProcessedEpoch: async () => {},
  };
}
