import test from "node:test";
import assert from "node:assert/strict";

import type { DagobertTransaction } from "@/src/modules/transaction";
import { TradeStyle, TradeType } from "@/src/modules/transaction";
import type {
  DagobertTransactionGroup,
  TransactionGroupRepository,
} from "@/src/modules/transaction-group";
import {
  GetTransactionGroupUseCase,
  ListTransactionGroupsUseCase,
} from "@/src/modules/transaction-group";

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
  grouped: true,
  note: "",
  otherSideOrderId: "",
  tradeType: TradeType.Spot,
  tradeStyle: TradeStyle.Swing,
  ...overrides,
});

const makeTransactionGroup = (
  overrides: Partial<DagobertTransactionGroup>
): DagobertTransactionGroup => ({
  groupId: "group-1",
  pair: "SOLUSDC",
  amount: 10,
  executed: 0.1,
  tradeType: TradeType.Spot,
  lastTransDateEpoch: 1000,
  groupedTrans: [makeTransaction({})],
  note: "",
  ...overrides,
});

test("transaction group list use case szűr és utolsó tranzakció dátuma szerint csökkenően rendez", async () => {
  const repository = makeInMemoryTransactionGroupRepository([
    makeTransactionGroup({ groupId: "old-sol", lastTransDateEpoch: 1000 }),
    makeTransactionGroup({
      groupId: "margin-sol",
      lastTransDateEpoch: 3000,
      tradeType: TradeType.Margin,
    }),
    makeTransactionGroup({ groupId: "btc", pair: "BTCUSDC", lastTransDateEpoch: 4000 }),
    makeTransactionGroup({ groupId: "new-sol", lastTransDateEpoch: 2000 }),
  ]);

  const result = await new ListTransactionGroupsUseCase(repository).execute({
    pair: "SOLUSDC",
    tradeType: TradeType.Spot,
  });

  assert.deepEqual(
    result.map((group) => group.groupId),
    ["new-sol", "old-sol"]
  );
});

test("transaction group get use case visszaadja a groupot vagy stabil hibát ad", async () => {
  const group = makeTransactionGroup({ groupId: "group-get" });
  const repository = makeInMemoryTransactionGroupRepository([group]);
  const useCase = new GetTransactionGroupUseCase(repository);

  const successResult = await useCase.execute("group-get");
  assert.equal(successResult.ok, true);
  assert.deepEqual(successResult.transactionGroup, group);

  const missingResult = await useCase.execute("missing");
  assert.equal(missingResult.ok, false);
  assert.equal(missingResult.transactionGroup, null);
  assert.match(missingResult.error, /Transaction group not found/);
});

test("korábban mentett, vegyes tranzakciócsoport továbbra is olvasható", async () => {
  const legacyGroup = makeTransactionGroup({
    groupId: "legacy-mixed-group",
    groupedTrans: [
      makeTransaction({ orderId: "sol", pair: "SOLUSDC" }),
      makeTransaction({ orderId: "btc", pair: "BTCUSDC" }),
    ],
  });
  const repository = makeInMemoryTransactionGroupRepository([legacyGroup]);

  const result = await new GetTransactionGroupUseCase(repository).execute(
    "legacy-mixed-group"
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.transactionGroup, legacyGroup);
});

function makeInMemoryTransactionGroupRepository(
  seed: DagobertTransactionGroup[]
): TransactionGroupRepository {
  const groups = new Map(seed.map((group) => [group.groupId, group]));

  return {
    findAll: async () => Array.from(groups.values()),
    findById: async (id: string) => groups.get(id) ?? null,
    save: async (group: DagobertTransactionGroup) => {
      groups.set(group.groupId, group);
    },
    delete: async (id: string) => {
      groups.delete(id);
    },
  };
}
