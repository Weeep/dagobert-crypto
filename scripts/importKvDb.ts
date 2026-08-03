import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import {
  importKvDump,
  type KvDump,
} from "./kv/kvToPostgresMigration";

dotenv.config({ path: ".env.local" });

async function main(): Promise<void> {
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
