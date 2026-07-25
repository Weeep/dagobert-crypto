import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import {
  importRedisDatabase,
  type RedisDatabaseDump,
  withRedisToolingClient,
} from "./kv/redisDatabaseTooling";

dotenv.config({ path: ".env.local" });

async function main(): Promise<void> {
  const dump = JSON.parse(
    await readFile("vercel_kv_export.json", "utf8")
  ) as RedisDatabaseDump;

  await withRedisToolingClient((redis) => importRedisDatabase(redis, dump));
  console.log("Database imported successfully!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
