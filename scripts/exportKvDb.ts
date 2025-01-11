// scripts/exportKv.ts
//import fs from "fs";
//import { kv } from "@vercel/kv";
//import dotenv from "dotenv";

const fse = require("fs");
const { kv: kve } = require("@vercel/kv");
const dotenve = require("dotenv");

dotenve.config({ path: ".env.local" });

async function exportKvDatabase() {
  const data: Record<string, any> = {};

  let cursor = 0;
  let resp: [nextCursor: number, keys: string[]] = [0, []];
  do {
    resp = await kve.scan(cursor);
    cursor = resp[0];

    for (const key of resp[1]) {
      try {
        // Get the type of the key
        const type = await kve.type(key);

        // Fetch data based on the type
        if (type === "string") {
          data[key] = await kve.get(key);
        } else if (type === "hash") {
          data[key] = await kve.hgetall(key); // Fetch all fields in the hash
        } else if (type === "list") {
          data[key] = await kve.lrange(key, 0, -1); // Fetch all elements in the list
        } else if (type === "set") {
          data[key] = await kve.smembers(key); // Fetch all members of the set
        } else if (type === "zset") {
          data[key] = await kve.zrange(key, 0, -1, { withScores: true }); // Fetch all members of the sorted set
        } else {
          console.warn(`Unknown type for key "${key}": ${type}`);
        }
      } catch (error) {
        console.error(`Error processing key "${key}":`, error);
      }
    }
  } while (cursor !== 0);

  fse.writeFileSync("vercel_kv_export.json", JSON.stringify(data, null, 2));
  console.log("Database exported successfully!");
}

exportKvDatabase().catch(console.error);
