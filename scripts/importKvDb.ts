import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import {
  importKvDump,
  KV_IMPORT_CLEARED_TABLES,
  type KvDump,
} from "./kv/kvToPostgresMigration";

const DESTRUCTIVE_IMPORT_WARNING = `WARNING: the KV import replaces PostgreSQL data.
It deletes every row from these tables before importing the JSON dump:
  ${KV_IMPORT_CLEARED_TABLES.join(", ")}
Only users, pairs, transaction groups, transactions and import cursors are restored from the KV export.
Type IMPORT to continue: `;

type Question = (prompt: string) => Promise<string>;

async function terminalQuestion(prompt: string): Promise<string> {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await readline.question(prompt);
  } finally {
    readline.close();
  }
}

/** Requires an explicit acknowledgement before the destructive import starts. */
export async function confirmKvImport(
  question: Question = terminalQuestion
): Promise<boolean> {
  return (await question(DESTRUCTIVE_IMPORT_WARNING)).trim() === "IMPORT";
}

async function main(): Promise<void> {
  dotenv.config({ path: ".env.local" });
  if (!(await confirmKvImport())) {
    console.log("KV import cancelled; PostgreSQL was not modified.");
    return;
  }

  const file = process.argv[2] ?? "vercel_kv_export.json";
  const dump = JSON.parse(await readFile(file, "utf8")) as KvDump;
  const prisma = new PrismaClient();

  try {
    const summary = await importKvDump(prisma, dump);
    console.log(`PostgreSQL import completed from ${file}.`);
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
