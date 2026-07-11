//import fs from "fs";
//import { kv } from "@vercel/kv";
//import dotenv from "dotenv";

const fsi = require("fs");
const { kv: kvi } = require("../utils/kv");
const dotenvi = require("dotenv");

dotenvi.config({ path: ".env.local" });

async function importDatabase() {
  kvi.reconnect();

  // Read the JSON file
  const data = JSON.parse(fsi.readFileSync("vercel_kv_export.json", "utf8"));

  // Import each key-value pair into the database
  for (const [key, value] of Object.entries(data)) {
    try {
      if (typeof value === "string" || typeof value === "number") {
        // String or numeric: Use `kv.set` (Basic)
        console.log("set" + key);
        await kvi.set(key, value);
      } else if (Array.isArray(value)) {
        // Array: use `kv.sadd` (Set)
        console.log("sadd" + key);
        await kvi.sadd(key, ...value); //kv.rpush(key, ...value);
      } else if (value && typeof value === "object") {
        // Hash: Use `kv.hset` (Hash)
        console.log("hset" + key);
        await kvi.hset(key, value);
      } else {
        console.warn(`Unrecognized data structure for key "${key}". Skipping.`);
      }
    } catch (error) {
      console.error(`Error importing key "${key}":`, error);
    }
  }

  console.log("Database imported successfully!");
}

importDatabase().catch(console.error);
