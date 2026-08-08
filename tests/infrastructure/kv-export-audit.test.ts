import assert from "node:assert/strict";
import test from "node:test";
import { auditKvExport } from "@/scripts/auditKvExport";
import { confirmKvImport } from "@/scripts/importKvDb";
import {
  importKvDump,
  KV_IMPORT_CLEAR_PLAN,
  prepareMigrationData,
  describeRowDifferences,
  verifyMigratedPassword,
} from "@/scripts/kv/kvToPostgresMigration";

test("KV import requires an explicit destructive-operation confirmation", async () => {
  let prompt = "";
  const ask = (answer: string) => async (message: string) => {
    prompt = message;
    return answer;
  };

  assert.equal(await confirmKvImport(ask("yes")), false);
  assert.equal(await confirmKvImport(ask("IMPORT\n")), true);
  for (const [, table] of KV_IMPORT_CLEAR_PLAN) assert.match(prompt, new RegExp(table));
  assert.match(prompt, /Only users, pairs, transaction groups, transactions and import cursors are restored/);
});

test("KV import clears candles before replacing pairs", async () => {
  const calls: string[] = [];
  const model = (name: string) => ({
    deleteMany: async () => calls.push(`delete:${name}`),
    createMany: async () => calls.push(`create:${name}`),
  });
  const tx = Object.fromEntries(KV_IMPORT_CLEAR_PLAN
    .map(([name]) => [name, model(name)]));
  const prisma = {
    $transaction: async (operation: (client: typeof tx) => Promise<void>) =>
      operation(tx),
  };

  await importKvDump(prisma, {
    users: {},
    pairs: {},
    dtransactions: {},
    dtransactionGroups: {},
  });

  assert.deepEqual(calls, KV_IMPORT_CLEAR_PLAN
    .map(([name]) => `delete:${name}`));
  assert.ok(calls.indexOf("delete:strategyDecision") < calls.indexOf("delete:candle"));
  assert.ok(calls.indexOf("delete:indicatorSnapshot") < calls.indexOf("delete:candle"));
  assert.ok(calls.indexOf("delete:bot") < calls.indexOf("delete:pair"));
});

test("KV export audit reports migration blockers without exposing passwords", () => {
  const audit = auditKvExport({
    users: { "user@example.com": "secret-password" },
    pairs: { BTCUSDT: { pair: "BTCUSDT", decimals: 2, keyLevels: [] } },
    dtransactions: {
      order1: {
        orderId: "order1",
        binanceApiId: 1,
        pair: "MISSINGPAIR",
        amount: 1,
        executed: 1,
        price: 1,
        dateEpoch: 1,
        date: "2026-01-01T00:00:00.000Z",
        tradeType: "spot",
        tradeStyle: "swing",
        side: "BUY",
        status: "FILLED",
        grouped: false,
      },
    },
    dtransactionGroups: {},
    last_transaction_epoch_spot_BTCUSDT: 1,
  });

  assert.deepEqual(audit.counts, {
    users: 1,
    pairs: 1,
    transactions: 1,
    transactionGroups: 0,
    importCursors: 1,
  });
  assert.deepEqual(
    audit.issues.map((issue) => issue.code),
    ["PLAINTEXT_PASSWORDS", "MISSING_TRANSACTION_PAIR"]
  );
  assert.equal(JSON.stringify(audit).includes("secret-password"), false);
});

test("migration validator describes missing, unexpected and changed fields", () => {
  const differences = describeRowDifferences(
    [
      { symbol: "BTCUSDT", decimals: 2, keyLevels: [1] },
      { symbol: "ETHUSDT", decimals: 3, keyLevels: [] },
    ],
    [
      { symbol: "BTCUSDT", decimals: 4, keyLevels: [1] },
      { symbol: "SOLUSDT", decimals: 2, keyLevels: [] },
    ],
    ["symbol"]
  );

  assert.deepEqual(differences, [
    "row BTCUSDT, field decimals: expected 2, actual 4",
    "missing row ETHUSDT",
    "unexpected row SOLUSDT",
  ]);
});

test("migration validator compares Prisma-like decimals by value", () => {
  const prismaDecimal = {
    s: 1,
    e: -1,
    d: [8350000],
    toFixed: () => "0.835",
    toString: () => "0.835",
  };

  assert.deepEqual(
    describeRowDifferences(
      [{ symbol: "ENAUSDC", keyLevels: ["0.835"] }],
      [{ symbol: "ENAUSDC", keyLevels: [prismaDecimal] }],
      ["symbol"]
    ),
    []
  );
});

test("migration filters every record associated with a deleted pair", async () => {
  const transaction = (orderId: string, pair: string) => ({
    orderId, pair, binanceApiId: 1, amount: 2, executed: 3, price: 4,
    dateEpoch: 1767225600000, date: "2026-01-01T00:00:00.000Z",
    tradeType: "spot", tradeStyle: "swing", side: "BUY", status: "FILLED",
    grouped: true,
  });
  const migration = await prepareMigrationData({
    users: { "user@example.com": "legacy-secret" },
    pairs: { BTCUSDT: { pair: "BTCUSDT", decimals: 2, keyLevels: [1.5] } },
    dtransactions: {
      kept: transaction("kept", "BTCUSDT"),
      orphaned: transaction("orphaned", "BTCUSDT"),
      removed: transaction("removed", "SOLUSDT"),
    },
    dtransactionGroups: {
      "00000000-0000-0000-0000-000000000001": {
        pair: "BTCUSDT", amount: 2, executed: 3, tradeType: "spot",
        lastTransDateEpoch: 1, groupedTrans: [transaction("kept", "BTCUSDT")],
      },
      "00000000-0000-0000-0000-000000000002": {
        pair: "SOLUSDT", amount: 2, executed: 3, tradeType: "spot",
        lastTransDateEpoch: 1,
        groupedTrans: [
          transaction("removed", "SOLUSDT"),
          transaction("orphaned", "BTCUSDT"),
        ],
      },
    },
    last_transaction_epoch_spot_BTCUSDT: 10,
    last_transaction_epoch_spot_SOLUSDT: 20,
  });

  assert.deepEqual(migration.transactions.map((row) => row.orderId), ["kept", "orphaned"]);
  assert.equal(migration.groups.length, 1);
  assert.deepEqual(migration.cursors.map((row) => row.pairSymbol), ["BTCUSDT"]);
  assert.deepEqual(migration.summary.skipped, {
    transactionsWithDeletedPair: 1,
    groupsWithDeletedPair: 1,
    cursorsWithDeletedPair: 1,
  });
  assert.match(migration.users[0].passwordHash, /^scrypt\$v=1\$N=32768\$r=8\$p=1\$/);
  assert.equal(migration.users[0].passwordHash.includes("legacy-secret"), false);
  assert.equal(
    await verifyMigratedPassword(
      "legacy-secret",
      migration.users[0].passwordHash
    ),
    true
  );
  assert.equal(
    await verifyMigratedPassword("wrong-password", migration.users[0].passwordHash),
    false
  );
  assert.equal(migration.transactions[0].transactionGroupId, "00000000-0000-0000-0000-000000000001");
  assert.equal(migration.transactions[1].transactionGroupId, null);
  assert.equal(migration.transactions[1].grouped, true);
});
