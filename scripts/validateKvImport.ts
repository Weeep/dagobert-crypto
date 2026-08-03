import { readFile } from "node:fs/promises";
import { scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { prepareMigrationData, type KvDump } from "./kv/kvToPostgresMigration";

dotenv.config({ path: ".env.local" });

async function passwordMatches(password: string, encoded: string): Promise<boolean> {
  const match = /^scrypt\$v=1\$N=(\d+)\$r=(\d+)\$p=(\d+)\$([^$]+)\$([^$]+)$/.exec(encoded);
  if (!match) return false;
  const expected = Buffer.from(match[6], "base64");
  const actual = await new Promise<Buffer>((resolve, reject) =>
    nodeScrypt(password, Buffer.from(match[5], "base64"), expected.length, {
      N: Number(match[1]), r: Number(match[2]), p: Number(match[3]), maxmem: 64 * 1024 * 1024,
    }, (error, result) => error ? reject(error) : resolve(result))
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function comparable(value: any): any {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(comparable);
  if (value && typeof value === "object") {
    if (typeof value.toFixed === "function" && value.constructor?.name === "Decimal") return value.toString();
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, comparable(item)]));
  }
  return value;
}

function sameRows(name: string, expected: any[], actual: any[], keys: string[]): void {
  const sort = (rows: any[]) => rows.map(comparable).sort((a, b) =>
    keys.map((key) => String(a[key])).join("|").localeCompare(keys.map((key) => String(b[key])).join("|"))
  );
  const left = JSON.stringify(sort(expected));
  const right = JSON.stringify(sort(actual));
  if (left !== right) throw new Error(`${name} differs between the filtered KV export and PostgreSQL.`);
}

async function main(): Promise<void> {
  const file = process.argv[2] ?? "vercel_kv_export.json";
  const dump = JSON.parse(await readFile(file, "utf8")) as KvDump;
  const expected = await prepareMigrationData(dump);
  const prisma = new PrismaClient();
  try {
    const [users, pairs, groups, transactions, cursors] = await Promise.all([
      prisma.user.findMany({ select: { email: true, passwordHash: true } }),
      prisma.pair.findMany({ select: { symbol: true, decimals: true, keyLevels: true } }),
      prisma.transactionGroup.findMany({ select: { id: true, pairSymbol: true, amount: true, executed: true, tradeType: true, lastTransDateEpoch: true, note: true } }),
      prisma.transaction.findMany({ select: { orderId: true, binanceApiId: true, pairSymbol: true, amount: true, executed: true, date: true, dateEpoch: true, side: true, price: true, status: true, grouped: true, note: true, otherSideOrderId: true, tradeType: true, tradeStyle: true, transactionGroupId: true } }),
      prisma.importCursor.findMany({ select: { pairSymbol: true, tradeType: true, lastProcessedEpoch: true } }),
    ]);
    const rawUsers = dump.users as Record<string, unknown>;
    if (users.length !== Object.keys(rawUsers ?? {}).length) throw new Error("users row count differs.");
    for (const user of users) {
      if (!(await passwordMatches(String(rawUsers[user.email]), user.passwordHash))) throw new Error(`Password hash validation failed for ${user.email}.`);
    }
    sameRows("pairs", expected.pairs, pairs, ["symbol"]);
    sameRows("transaction groups", expected.groups, groups, ["id"]);
    sameRows("transactions", expected.transactions, transactions, ["orderId"]);
    sameRows("import cursors", expected.cursors, cursors, ["pairSymbol", "tradeType"]);
    console.log(`Validation successful for ${file}.`);
    console.log(JSON.stringify(expected.summary, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
