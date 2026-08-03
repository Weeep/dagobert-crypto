import assert from "node:assert/strict";
import test from "node:test";
import { auditKvExport } from "@/scripts/auditKvExport";
import {
  prepareMigrationData,
  describeRowDifferences,
  verifyMigratedPassword,
} from "@/scripts/kv/kvToPostgresMigration";

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
