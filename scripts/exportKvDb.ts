// scripts/exportKv.ts
//import fs from "fs";
//import { kv } from "@vercel/kv";
//import dotenv from "dotenv";

const fs = require("fs");
const { kv } = require("@vercel/kv");
const dotenv = require("dotenv");

dotenv.config({ path: ".env.local" });

async function exportKvDatabase() {
  const data: Record<string, any> = {};

  let cursor = 0;
  let resp: [nextCursor: number, keys: string[]] = [0, []];
  do {
    resp = await kv.scan(cursor);
    cursor = resp[0];

    for (const key of resp[1]) {
      try {
        // Get the type of the key
        const type = await kv.type(key);

        // Fetch data based on the type
        if (type === "string") {
          data[key] = await kv.get(key);
        } else if (type === "hash") {
          data[key] = await kv.hgetall(key); // Fetch all fields in the hash
        } else if (type === "list") {
          data[key] = await kv.lrange(key, 0, -1); // Fetch all elements in the list
        } else if (type === "set") {
          data[key] = await kv.smembers(key); // Fetch all members of the set
        } else if (type === "zset") {
          data[key] = await kv.zrange(key, 0, -1, { withScores: true }); // Fetch all members of the sorted set
        } else {
          console.warn(`Unknown type for key "${key}": ${type}`);
        }
      } catch (error) {
        console.error(`Error processing key "${key}":`, error);
      }
    }
  } while (cursor !== 0);

  fs.writeFileSync("vercel_kv_export.json", JSON.stringify(data, null, 2));
  console.log("Database exported successfully!");
}

exportKvDatabase().catch(console.error);
