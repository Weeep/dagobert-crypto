import assert from "node:assert/strict";
import test from "node:test";
import { auditKvExport } from "@/scripts/auditKvExport";

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
