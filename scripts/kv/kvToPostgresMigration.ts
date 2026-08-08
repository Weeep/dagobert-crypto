import {
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";

const CURSOR_PREFIX = "last_transaction_epoch_";
const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

type JsonObject = Record<string, any>;
export type KvDump = Record<string, unknown>;
type MigrationTransaction = {
  [model: string]: { deleteMany(): Promise<unknown>; createMany(args: { data: any[] }): Promise<unknown> };
};
type MigrationPrismaClient = {
  // Prisma exposes $transaction as an overloaded method (batch and interactive
  // forms). Keeping the public boundary broad lets a real PrismaClient as well
  // as a test double satisfy it; the importer narrows to the interactive form
  // at the single call site below.
  $transaction: unknown;
};
type InteractiveTransaction = <T>(
  operation: (tx: MigrationTransaction) => Promise<T>,
  options: { timeout: number }
) => Promise<T>;

export type MigrationSummary = {
  imported: Record<string, number>;
  skipped: {
    transactionsWithDeletedPair: number;
    groupsWithDeletedPair: number;
    cursorsWithDeletedPair: number;
  };
};

export type MigrationData = {
  users: Array<{ email: string; passwordHash: string }>;
  pairs: Array<{ symbol: string; decimals: number; keyLevels: string[] }>;
  groups: Array<JsonObject>;
  transactions: Array<JsonObject>;
  cursors: Array<JsonObject>;
  summary: MigrationSummary;
};

function comparable(value: any): any {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(comparable);
  if (value && typeof value === "object") {
    // Prisma's Decimal constructor name is not stable across generated client
    // builds/minification. Detect decimal-like values by their public numeric
    // API instead of the constructor name, otherwise their internal s/e/d
    // representation is compared with the source string.
    if (
      typeof value.toFixed === "function" &&
      typeof value.toString === "function"
    ) {
      return value.toString();
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, comparable(item)])
    );
  }
  return value;
}

function rowKey(row: JsonObject, keys: string[]): string {
  return keys.map((key) => String(row[key])).join("|");
}

function display(value: unknown): string {
  return JSON.stringify(value) ?? String(value);
}

/** Returns actionable row/field differences, capped to keep CLI output useful. */
export function describeRowDifferences(
  expectedRows: any[],
  actualRows: any[],
  keys: string[],
  limit = 20
): string[] {
  const expected = new Map(
    expectedRows.map(comparable).map((row) => [rowKey(row, keys), row])
  );
  const actual = new Map(
    actualRows.map(comparable).map((row) => [rowKey(row, keys), row])
  );
  const differences: string[] = [];
  let differenceCount = 0;
  const add = (message: string): void => {
    differenceCount += 1;
    if (differences.length < limit) differences.push(message);
  };

  expected.forEach((expectedRow, key) => {
    const actualRow = actual.get(key);
    if (!actualRow) {
      add(`missing row ${key}`);
      return;
    }
    const fields = new Set([
      ...Object.keys(expectedRow),
      ...Object.keys(actualRow),
    ]);
    Array.from(fields).forEach((field) => {
      if (display(expectedRow[field]) !== display(actualRow[field])) {
        add(
          `row ${key}, field ${field}: expected ${display(expectedRow[field])}, actual ${display(actualRow[field])}`
        );
      }
    });
  });
  actual.forEach((_, key) => {
    if (!expected.has(key)) add(`unexpected row ${key}`);
  });

  if (differenceCount > limit) {
    differences.push(
      `${differenceCount - limit} additional difference(s) omitted; output limited to ${limit}`
    );
  }
  return differences;
}

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

export async function hashLegacyPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await new Promise<Buffer>((resolve, reject) =>
    nodeScrypt(password, salt, 64, SCRYPT_OPTIONS, (error, result) =>
      error ? reject(error) : resolve(result)
    )
  );
  return `scrypt$v=1$N=32768$r=8$p=1$${salt.toString("base64")}$${key.toString("base64")}`;
}

/** Verifies the versioned password representation written by the importer. */
export async function verifyMigratedPassword(
  password: string,
  encoded: string
): Promise<boolean> {
  const match =
    /^scrypt\$v=1\$N=(\d+)\$r=(\d+)\$p=(\d+)\$([^$]+)\$([^$]+)$/.exec(
      encoded
    );
  if (!match) return false;

  const salt = Buffer.from(match[4], "base64");
  const expected = Buffer.from(match[5], "base64");
  const actual = await new Promise<Buffer>((resolve, reject) =>
    nodeScrypt(
      password,
      salt,
      expected.length,
      {
        N: Number(match[1]),
        r: Number(match[2]),
        p: Number(match[3]),
        maxmem: SCRYPT_OPTIONS.maxmem,
      },
      (error, result) => (error ? reject(error) : resolve(result))
    )
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function prepareMigrationData(dump: KvDump): Promise<MigrationData> {
  const rawUsers = object(dump.users);
  const rawPairs = object(dump.pairs);
  const rawTransactions = object(dump.dtransactions);
  const rawGroups = object(dump.dtransactionGroups);
  const pairSymbols = new Set(Object.keys(rawPairs));

  const users = await Promise.all(
    Object.entries(rawUsers).map(async ([email, password]) => ({
      email,
      passwordHash: await hashLegacyPassword(String(password)),
    }))
  );
  const pairs = Object.entries(rawPairs).map(([symbol, value]) => {
    const pair = object(value);
    return {
      symbol,
      decimals: Number(pair.decimals),
      keyLevels: (Array.isArray(pair.keyLevels) ? pair.keyLevels : []).map(String),
    };
  });

  const importedGroups = Object.entries(rawGroups).filter(([, value]) =>
    pairSymbols.has(String(object(value).pair))
  );
  const membership = new Map<string, string>();
  for (const [groupId, value] of importedGroups) {
    const group = object(value);
    for (const transaction of Array.isArray(group.groupedTrans)
      ? group.groupedTrans
      : []) {
      const orderId = String(object(transaction).orderId);
      const previous = membership.get(orderId);
      if (previous && previous !== groupId) {
        throw new Error(
          `Transaction ${orderId} belongs to multiple imported groups (${previous}, ${groupId}).`
        );
      }
      membership.set(orderId, groupId);
    }
  }
  const groups = importedGroups.map(([id, value]) => {
    const group = object(value);
    return {
      id,
      pairSymbol: String(group.pair),
      amount: String(group.amount),
      executed: String(group.executed),
      tradeType: group.tradeType,
      lastTransDateEpoch: BigInt(group.lastTransDateEpoch),
      note: typeof group.note === "string" ? group.note : "",
    };
  });

  const transactions = Object.values(rawTransactions)
    .map(object)
    .filter((transaction) => pairSymbols.has(String(transaction.pair)))
    .map((transaction) => {
      const transactionGroupId = membership.get(String(transaction.orderId)) ?? null;
      return {
        orderId: String(transaction.orderId),
        binanceApiId: BigInt(transaction.binanceApiId),
        pairSymbol: String(transaction.pair),
        amount: String(transaction.amount),
        executed: String(transaction.executed),
        date: new Date(String(transaction.date)),
        dateEpoch: BigInt(transaction.dateEpoch),
        side: transaction.side,
        price: String(transaction.price),
        status: transaction.status,
        // A retained transaction can have belonged to a group whose own pair was
        // deleted. The group must not be imported, but clearing this compatibility
        // flag would incorrectly make the completed trade appear open again.
        grouped: transaction.grouped === true || transactionGroupId !== null,
        note: typeof transaction.note === "string" ? transaction.note : "",
        otherSideOrderId:
          typeof transaction.otherSideOrderId === "string" &&
          transaction.otherSideOrderId.length > 0
            ? transaction.otherSideOrderId
            : null,
        tradeType: transaction.tradeType,
        tradeStyle: transaction.tradeStyle,
        transactionGroupId,
      };
    });

  const cursorEntries = Object.entries(dump).filter(([key]) =>
    key.startsWith(CURSOR_PREFIX)
  );
  const cursors = cursorEntries.flatMap(([key, value]) => {
    const match = /^last_transaction_epoch_(spot|margin)_(.+)$/.exec(key);
    if (!match || !pairSymbols.has(match[2])) return [];
    return [{
      tradeType: match[1],
      pairSymbol: match[2],
      lastProcessedEpoch: BigInt(value as number),
    }];
  });

  return {
    users,
    pairs,
    groups,
    transactions,
    cursors,
    summary: {
      imported: {
        users: users.length,
        pairs: pairs.length,
        transactionGroups: groups.length,
        transactions: transactions.length,
        importCursors: cursors.length,
      },
      skipped: {
        transactionsWithDeletedPair:
          Object.keys(rawTransactions).length - transactions.length,
        groupsWithDeletedPair: Object.keys(rawGroups).length - groups.length,
        cursorsWithDeletedPair: cursorEntries.length - cursors.length,
      },
    },
  };
}

/** Replaces migration-owned PostgreSQL data atomically with the filtered KV dump. */
export async function importKvDump(
  prisma: MigrationPrismaClient,
  dump: KvDump
): Promise<MigrationSummary> {
  const data = await prepareMigrationData(dump);
  const transaction = prisma.$transaction as InteractiveTransaction;
  await transaction.call(
    prisma,
    async (tx) => {
      await tx.transaction.deleteMany();
      await tx.transactionGroup.deleteMany();
      await tx.importCursor.deleteMany();
      // Candles use a restrictive pair foreign key, so they must be cleared
      // before the authoritative KV pair set replaces the existing rows.
      await tx.candle.deleteMany();
      await tx.pair.deleteMany();
      await tx.user.deleteMany();
      if (data.users.length) await tx.user.createMany({ data: data.users });
      if (data.pairs.length) await tx.pair.createMany({ data: data.pairs });
      if (data.groups.length)
        await tx.transactionGroup.createMany({
          data: data.groups,
        });
      if (data.transactions.length)
        await tx.transaction.createMany({
          data: data.transactions,
        });
      if (data.cursors.length)
        await tx.importCursor.createMany({
          data: data.cursors,
        });
    },
    { timeout: 120_000 }
  );
  return data.summary;
}
