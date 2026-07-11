import test from "node:test";
import assert from "node:assert/strict";

import { binanceOrdersToTransactionsByPair } from "@/src/modules/transaction/application/mappers/binanceOrderToTransaction";
import { KvPairRepository } from "@/src/modules/pair/infrastructure/kv/KvPairRepository";
import { ImportTransactionsStoreService } from "@/src/modules/transaction/application/import-transactions/ImportTransactionsStoreService";
import { KvTransactionRepository } from "@/src/modules/transaction/infrastructure/kv/KvTransactionRepository";
import { DtransactionGroups } from "@/src/modules/transaction-group";
import { TransactionIf } from "@/app/lib/Interfaces";
import ClientSideDbCache from "@/app/lib/ClientSideDbCache";
import type { DagobertTransaction } from "@/src/modules/transaction";
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

  const group = DtransactionGroups.group([buy, sell]);

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
      new KvTransactionRepository(),
      new KvPairRepository()
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
