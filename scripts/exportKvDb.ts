import { writeFile } from "node:fs/promises";
import dotenv from "dotenv";
import {
  exportRedisDatabase,
  withRedisToolingClient,
} from "./kv/redisDatabaseTooling";

dotenv.config({ path: ".env.local" });

async function main(): Promise<void> {
  const dump = await withRedisToolingClient(exportRedisDatabase);
  await writeFile("vercel_kv_export.json", JSON.stringify(dump, null, 2));
  console.log("Database exported successfully!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
