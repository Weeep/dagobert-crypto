import { readFile } from "node:fs/promises";

type JsonRecord = Record<string, unknown>;

export type AuditSeverity = "error" | "warning";

export type AuditIssue = {
  severity: AuditSeverity;
  code: string;
  message: string;
  count: number;
  samples: string[];
};

export type KvExportAudit = {
  counts: {
    users: number;
    pairs: number;
    transactions: number;
    transactionGroups: number;
    importCursors: number;
  };
  issues: AuditIssue[];
};

const tradeTypes = new Set(["spot", "margin"]);
const tradeStyles = new Set(["day", "swing", "hodling", "trash"]);
const orderSides = new Set(["BUY", "SELL"]);
const orderStatuses = new Set(["FILLED", "CANCELED", "NEW"]);

function record(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function addIssue(
  issues: AuditIssue[],
  severity: AuditSeverity,
  code: string,
  message: string,
  values: string[]
): void {
  if (values.length === 0) return;
  issues.push({
    severity,
    code,
    message,
    count: values.length,
    samples: values.slice(0, 5),
  });
}

function invalidTransaction(transaction: JsonRecord): boolean {
  const numericFields = [
    "amount",
    "executed",
    "price",
    "dateEpoch",
    "binanceApiId",
  ];
  return (
    typeof transaction.orderId !== "string" ||
    typeof transaction.pair !== "string" ||
    !numericFields.every(
      (field) =>
        typeof transaction[field] === "number" &&
        Number.isFinite(transaction[field])
    ) ||
    !tradeTypes.has(String(transaction.tradeType)) ||
    !tradeStyles.has(String(transaction.tradeStyle)) ||
    !orderSides.has(String(transaction.side)) ||
    !orderStatuses.has(String(transaction.status)) ||
    typeof transaction.grouped !== "boolean" ||
    Number.isNaN(Date.parse(String(transaction.date)))
  );
}

/** Audits a parsed Redis export without changing the dump or either database. */
export function auditKvExport(value: unknown): KvExportAudit {
  const dump = record(value);
  const users = record(dump.users);
  const pairs = record(dump.pairs);
  const transactions = record(dump.dtransactions);
  const groups = record(dump.dtransactionGroups);
  const issues: AuditIssue[] = [];

  addIssue(
    issues,
    "error",
    "PLAINTEXT_PASSWORDS",
    "User credentials must be hashed with scrypt during migration.",
    Object.keys(users)
  );

  addIssue(
    issues,
    "error",
    "PAIR_KEY_MISMATCH",
    "Pair hash keys must match their pair field.",
    Object.entries(pairs)
      .filter(([symbol, pair]) => record(pair).pair !== symbol)
      .map(([symbol]) => symbol)
  );
  addIssue(
    issues,
    "error",
    "INVALID_PAIR",
    "Pairs must have non-negative integer decimals and finite numeric key levels.",
    Object.entries(pairs)
      .filter(([, rawPair]) => {
        const pair = record(rawPair);
        return (
          !Number.isInteger(pair.decimals) ||
          Number(pair.decimals) < 0 ||
          !Array.isArray(pair.keyLevels) ||
          !pair.keyLevels.every(
            (level) => typeof level === "number" && Number.isFinite(level)
          )
        );
      })
      .map(([symbol]) => symbol)
  );

  addIssue(
    issues,
    "error",
    "TRANSACTION_KEY_MISMATCH",
    "Transaction hash keys must match their globally unique orderId.",
    Object.entries(transactions)
      .filter(([orderId, transaction]) => record(transaction).orderId !== orderId)
      .map(([orderId]) => orderId)
  );

  addIssue(
    issues,
    "error",
    "INVALID_TRANSACTION",
    "Transactions must contain values supported by the initial Prisma schema.",
    Object.entries(transactions)
      .filter(([, transaction]) => invalidTransaction(record(transaction)))
      .map(([orderId]) => orderId)
  );

  addIssue(
    issues,
    "warning",
    "MISSING_TRANSACTION_PAIR",
    "Referenced pairs must be created before transactions are imported.",
    Object.values(transactions)
      .map((transaction) => String(record(transaction).pair))
      .filter((symbol) => !(symbol in pairs))
  );

  addIssue(
    issues,
    "error",
    "GROUP_KEY_MISMATCH",
    "Transaction-group hash keys must match their groupId.",
    Object.entries(groups)
      .filter(([groupId, group]) => record(group).groupId !== groupId)
      .map(([groupId]) => groupId)
  );
  addIssue(
    issues,
    "error",
    "INVALID_TRANSACTION_GROUP",
    "Transaction groups must contain values supported by the initial Prisma schema.",
    Object.entries(groups)
      .filter(([, rawGroup]) => {
        const group = record(rawGroup);
        return (
          typeof group.pair !== "string" ||
          typeof group.amount !== "number" ||
          !Number.isFinite(group.amount) ||
          typeof group.executed !== "number" ||
          !Number.isFinite(group.executed) ||
          typeof group.lastTransDateEpoch !== "number" ||
          !Number.isFinite(group.lastTransDateEpoch) ||
          !tradeTypes.has(String(group.tradeType)) ||
          !Array.isArray(group.groupedTrans)
        );
      })
      .map(([groupId]) => groupId)
  );

  addIssue(
    issues,
    "warning",
    "MISSING_GROUP_PAIR",
    "Referenced pairs must be created before transaction groups are imported.",
    Object.values(groups)
      .map((group) => String(record(group).pair))
      .filter((symbol) => !(symbol in pairs))
  );

  const memberships = new Map<string, string[]>();
  const missingGroupTransactions: string[] = [];
  for (const [groupId, rawGroup] of Object.entries(groups)) {
    const group = record(rawGroup);
    const groupedTransactions = Array.isArray(group.groupedTrans)
      ? group.groupedTrans
      : [];
    for (const rawTransaction of groupedTransactions) {
      const orderId = String(record(rawTransaction).orderId);
      if (!(orderId in transactions)) missingGroupTransactions.push(orderId);
      memberships.set(orderId, [...(memberships.get(orderId) ?? []), groupId]);
    }
  }

  addIssue(
    issues,
    "error",
    "MISSING_GROUP_TRANSACTION",
    "Embedded group transactions must exist in the primary transaction hash.",
    missingGroupTransactions
  );
  addIssue(
    issues,
    "error",
    "MULTIPLE_GROUP_MEMBERSHIP",
    "The relational model allows a transaction to belong to only one group.",
    Array.from(memberships.entries())
      .filter(([, groupIds]) => new Set(groupIds).size > 1)
      .map(([orderId]) => orderId)
  );

  const cursorKeys = Object.keys(dump).filter((key) =>
    key.startsWith("last_transaction_epoch_")
  );
  addIssue(
    issues,
    "error",
    "INVALID_IMPORT_CURSOR",
    "Import cursor keys must contain a supported trade type and pair symbol.",
    cursorKeys.filter((key) => {
      const value = dump[key];
      return (
        !/^last_transaction_epoch_(spot|margin)_[A-Z0-9]+$/.test(key) ||
        typeof value !== "number" ||
        !Number.isFinite(value)
      );
    })
  );

  return {
    counts: {
      users: Object.keys(users).length,
      pairs: Object.keys(pairs).length,
      transactions: Object.keys(transactions).length,
      transactionGroups: Object.keys(groups).length,
      importCursors: cursorKeys.length,
    },
    issues,
  };
}

async function main(): Promise<void> {
  const file = process.argv[2] ?? "vercel_kv_export.json";
  const audit = auditKvExport(JSON.parse(await readFile(file, "utf8")));
  console.log(`Read-only Redis export audit: ${file}`);
  console.log(JSON.stringify(audit.counts, null, 2));
  for (const issue of audit.issues) {
    console.log(
      `[${issue.severity.toUpperCase()}] ${issue.code}: ${issue.count} - ${issue.message}`
    );
    console.log(`  samples: ${issue.samples.join(", ")}`);
  }
  console.log(`Audit completed with ${audit.issues.length} issue categories.`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
