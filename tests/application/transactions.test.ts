import test from "node:test";
import assert from "node:assert/strict";

import { binanceOrdersToTransactionsByPair } from "@/src/modules/transaction/application/mappers/binanceOrderToTransaction";
import { ClientCachePairRepository } from "@/src/modules/pair/infrastructure/client-cache/ClientCachePairRepository";
import { ImportTransactionsStoreService } from "@/src/modules/transaction/application/import-transactions/ImportTransactionsStoreService";
import { ClientCacheTransactionRepository } from "@/src/modules/transaction/infrastructure/client-cache/ClientCacheTransactionRepository";
import {
  CreateTransactionGroupUseCase,
  buildTransactionGroup,
  type DagobertTransactionGroup,
  type TransactionGroupRepository,
} from "@/src/modules/transaction-group";
import { TransactionIf } from "@/app/lib/Interfaces";
import ClientSideDbCache from "@/app/lib/ClientSideDbCache";
import type { DagobertTransaction, TransactionRepository } from "@/src/modules/transaction";
import { TradeStyle, TradeType } from "@/src/modules/transaction";
import { KVRoot } from "@/src/shared/infrastructure/kv/KVRoot";

const binanceBuyOrder: TransactionIf = {
  symbol: "SOLUSDC",
  orderId: 12345,
  executedQty: "0.50000000",
  cummulativeQuoteQty: "50.00000000",
  status: "FILLED",
  type: "LIMIT",
  side: "BUY",
  updateTime: Date.UTC(2025, 0, 2, 12, 0, 0),
};

const binanceSellOrder: TransactionIf = {
  ...binanceBuyOrder,
  orderId: 12346,
  side: "SELL",
  executedQty: "0.25000000",
  cummulativeQuoteQty: "30.00000000",
  updateTime: Date.UTC(2025, 0, 3, 12, 0, 0),
};

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

test("Binance API orderből DagobertTransactiont készít a belső üzleti szabályok szerint", () => {
  const result = binanceOrdersToTransactionsByPair(
    [binanceBuyOrder, binanceSellOrder],
    TradeType.Spot
  );

  assert.deepEqual(Object.keys(result), ["SOLUSDC"]);
  assert.equal(result.SOLUSDC.length, 2);

  const [buy, sell] = result.SOLUSDC;

  assert.equal(buy.binanceApiId, binanceBuyOrder.orderId);
  assert.equal(buy.pair, "SOLUSDC");
  assert.equal(buy.amount, -50);
  assert.equal(buy.executed, 0.5);
  assert.equal(buy.price, 100);
  assert.equal(buy.status, "FILLED");
  assert.equal(buy.tradeType, TradeType.Spot);
  assert.equal(buy.tradeStyle, TradeStyle.Swing);
  assert.equal(buy.grouped, false);
  assert.equal(buy.dateEpoch, binanceBuyOrder.updateTime - 61 * 60_000);
  assert.ok(buy.orderId);

  assert.equal(sell.amount, 30);
  assert.equal(sell.executed, 0.25);
  assert.equal(sell.price, 120);
});

test("tranzakciócsoport képzés amount, executed és utolsó dátum alapján összesít", () => {
  const buy = makeTransaction({
    orderId: "buy-1",
    amount: -50,
    executed: 0.5,
    side: "BUY",
    dateEpoch: 1000,
  });
  const sell = makeTransaction({
    orderId: "sell-1",
    amount: 30,
    executed: 0.25,
    side: "SELL",
    dateEpoch: 3000,
  });

  const group = buildTransactionGroup([buy, sell]);

  assert.equal(group.groupId, null);
  assert.equal(group.pair, "SOLUSDC");
  assert.equal(group.tradeType, TradeType.Spot);
  assert.equal(group.amount, -20);
  assert.equal(group.executed, 0.25);
  assert.equal(group.lastTransDateEpoch, 3000);
  assert.deepEqual(group.groupedTrans, [buy, sell]);
});

test("duplicate/newer-than-stored logika: Binance API importnál csak a korábbinál újabb FILLED tranzakciót tárolja", async () => {
  const cache = new Map<string, any>([
    ["last_transaction_epoch_spot_SOLUSDC", "2000"],
    [KVRoot.pairs, { SOLUSDC: { pair: "SOLUSDC", decimals: 4, keyLevels: [] } }],
  ]);
  const storedTransactions: Record<string, DagobertTransaction> = {};
  const originalGet = ClientSideDbCache.get;
  const originalSet = ClientSideDbCache.set;
  const originalHget = ClientSideDbCache.hget;
  const originalHset = ClientSideDbCache.hset;

  ClientSideDbCache.get = ((key: string) => cache.get(key) ?? null) as any;
  ClientSideDbCache.set = (async (key: string, value: string) => {
    cache.set(key, value);
    return true;
  }) as any;
  ClientSideDbCache.hget = ((key: KVRoot, field: string) => {
    return cache.get(key)?.[field] ?? null;
  }) as any;
  ClientSideDbCache.hset = (async (key: KVRoot, value: Record<string, any>) => {
    if (key === KVRoot.dtransactions) {
      Object.assign(storedTransactions, value);
    }
    cache.set(key, { ...(cache.get(key) ?? {}), ...value });
    return true;
  }) as any;

  try {
    const oldFilled = makeTransaction({ orderId: "old", dateEpoch: 1000 });
    const newFilled = makeTransaction({ orderId: "new", dateEpoch: 3000 });
    const newerButRejected = makeTransaction({
      orderId: "rejected",
      dateEpoch: 4000,
      status: "CANCELED",
    });

    const storeService = new ImportTransactionsStoreService(
      new ClientCacheTransactionRepository(),
      new ClientCachePairRepository()
    );

    const result = await storeService.store(
      { SOLUSDC: [oldFilled, newerButRejected, newFilled] },
      TradeType.Spot,
      "binanceapi"
    );

    assert.deepEqual(result.pairInfo.SOLUSDC, {
      processed: 3,
      added: 1,
      skipped: 2,
    });
    assert.deepEqual(result.addedTransactions, [newFilled]);
    assert.deepEqual(Object.keys(storedTransactions), ["new"]);
    assert.equal(cache.get("last_transaction_epoch_spot_SOLUSDC"), "3000");
  } finally {
    ClientSideDbCache.get = originalGet;
    ClientSideDbCache.set = originalSet;
    ClientSideDbCache.hget = originalHget;
    ClientSideDbCache.hset = originalHset;
  }
});

test("tranzakciócsoport létrehozás use case menti a groupot és grouped=true-re állítja a tranzakciókat", async () => {
  const savedGroups: DagobertTransactionGroup[] = [];
  const savedTransactions: DagobertTransaction[] = [];
  const transactionGroupRepository: TransactionGroupRepository = {
    findAll: async () => savedGroups,
    findById: async (id: string) => savedGroups.find((group) => group.groupId === id) ?? null,
    save: async (group: DagobertTransactionGroup) => {
      savedGroups.push(group);
    },
    delete: async () => {},
  };
  const transactionRepository: TransactionRepository = {
    findAll: async () => savedTransactions,
    findById: async (id: string) =>
      savedTransactions.find((transaction) => transaction.orderId === id) ?? null,
    save: async (transaction: DagobertTransaction) => {
      savedTransactions.push(transaction);
    },
    saveMany: async (transactions: DagobertTransaction[]) => {
      savedTransactions.push(...transactions);
    },
    getLastProcessedEpoch: async () => null,
    setLastProcessedEpoch: async () => {},
  };
  const useCase = new CreateTransactionGroupUseCase(
    transactionGroupRepository,
    transactionRepository
  );
  const transactionGroup = buildTransactionGroup([
    makeTransaction({ orderId: "buy-1" }),
    makeTransaction({ orderId: "sell-1", side: "SELL", amount: 30 }),
  ]);

  const result = await useCase.execute([transactionGroup]);

  assert.equal(result.ok, true);
  assert.equal(savedGroups.length, 1);
  assert.ok(savedGroups[0].groupId);
  assert.equal(savedTransactions.length, 2);
  assert.deepEqual(
    savedTransactions.map((transaction) => transaction.grouped),
    [true, true]
  );
});

test("open tranzakciók listázása csak FILLED és nem csoportosított tranzakciókat ad vissza, szűrve és dátum szerint csökkenően", async () => {
  const transactions = [
    makeTransaction({ orderId: "old-open", dateEpoch: 1000, pair: "SOLUSDC" }),
    makeTransaction({
      orderId: "grouped",
      dateEpoch: 4000,
      pair: "SOLUSDC",
      grouped: true,
    }),
    makeTransaction({
      orderId: "canceled",
      dateEpoch: 5000,
      pair: "SOLUSDC",
      status: "CANCELED",
    }),
    makeTransaction({ orderId: "other-pair", dateEpoch: 3000, pair: "BTCUSDC" }),
    makeTransaction({ orderId: "new-open", dateEpoch: 2000, pair: "SOLUSDC" }),
  ];
  const repository = makeInMemoryTransactionRepository(transactions);
  const { ListOpenTransactionsUseCase } = await import("@/src/modules/transaction");

  const result = await new ListOpenTransactionsUseCase(repository).execute({
    pair: "SOLUSDC",
  });

  assert.deepEqual(
    result.map((transaction) => transaction.orderId),
    ["new-open", "old-open"]
  );
});

test("tranzakció update use case-ek repository boundaryn keresztül módosítják a mezőket", async () => {
  const transaction = makeTransaction({ orderId: "tx-update", note: "old" });
  const repository = makeInMemoryTransactionRepository([transaction]);
  const {
    UpdateTransactionNoteUseCase,
    UpdateTransactionTradeStyleUseCase,
    SetOtherSideOrderUseCase,
    ClearOtherSideOrderUseCase,
  } = await import("@/src/modules/transaction");

  const noteResult = await new UpdateTransactionNoteUseCase(repository).execute(
    "tx-update",
    "  new note  "
  );
  assert.equal(noteResult.ok, true);
  assert.equal(noteResult.transaction?.note, "new note");

  const tradeStyleResult = await new UpdateTransactionTradeStyleUseCase(repository).execute(
    "tx-update",
    TradeStyle.Day
  );
  assert.equal(tradeStyleResult.ok, true);
  assert.equal(tradeStyleResult.transaction?.tradeStyle, TradeStyle.Day);

  const setOrderResult = await new SetOtherSideOrderUseCase(repository).execute({
    orderId: "tx-update",
    otherSideOrderId: 98765,
    note: "SELL set",
  });
  assert.equal(setOrderResult.ok, true);
  assert.equal(setOrderResult.transaction?.otherSideOrderId, "98765");
  assert.equal(setOrderResult.transaction?.note, "SELL set");

  const clearOrderResult = await new ClearOtherSideOrderUseCase(repository).execute({
    orderId: "tx-update",
    note: "",
  });
  assert.equal(clearOrderResult.ok, true);
  assert.equal(clearOrderResult.transaction?.otherSideOrderId, "");
  assert.equal(clearOrderResult.transaction?.note, "");
});

test("tranzakció update use case hibát ad nem létező tranzakcióra", async () => {
  const repository = makeInMemoryTransactionRepository([]);
  const { UpdateTransactionNoteUseCase } = await import("@/src/modules/transaction");

  const result = await new UpdateTransactionNoteUseCase(repository).execute("missing", "note");

  assert.equal(result.ok, false);
  assert.equal(result.transaction, null);
  assert.match(result.error, /Transaction not found/);
});

function makeInMemoryTransactionRepository(
  seed: DagobertTransaction[]
): TransactionRepository {
  const transactions = new Map(
    seed.map((transaction) => [transaction.orderId, transaction])
  );

  return {
    findAll: async () => Array.from(transactions.values()),
    findById: async (id: string) => transactions.get(id) ?? null,
    save: async (transaction: DagobertTransaction) => {
      transactions.set(transaction.orderId, transaction);
    },
    saveMany: async (newTransactions: DagobertTransaction[]) => {
      for (const transaction of newTransactions) {
        transactions.set(transaction.orderId, transaction);
      }
    },
    getLastProcessedEpoch: async () => null,
    setLastProcessedEpoch: async () => {},
  };
}
