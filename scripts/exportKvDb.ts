// scripts/exportKv.ts

const DbApiUtil = require("../utils/dbapiutil").default;
const fse = require("fs");
const { kv: kve } = require("@vercel/kv");
const dotenve = require("dotenv");

dotenve.config({ path: ".env.local" });

async function exportKvDatabase() {
  const data = await DbApiUtil.getCache();

  fse.writeFileSync(
    "vercel_kv_export.json",
    JSON.stringify(data.cache, null, 2)
  );
  console.log("Database exported successfully!");
}

exportKvDatabase().catch(console.error);
