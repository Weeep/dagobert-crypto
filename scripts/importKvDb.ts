//import fs from "fs";
//import { kv } from "@vercel/kv";
//import dotenv from "dotenv";

const fs = require("fs");
const { kv } = require("@vercel/kv");
const dotenv = require("dotenv");

dotenv.config({ path: ".env.local" });

async function importDatabase() {
  // Read the JSON file
  const data = JSON.parse(fs.readFileSync("vercel_kv_export.json", "utf8"));

  // Import each key-value pair into the database
  for (const [key, value] of Object.entries(data)) {
    try {
      if (typeof value === "string" || typeof value === "number") {
        // String or numeric: Use `kv.set` (Basic)
        await kv.set(key, value);
      } else if (Array.isArray(value)) {
        // Array: use `kv.sadd` (Set)
        await kv.sadd(key, ...value); //kv.rpush(key, ...value);
      } else if (value && typeof value === "object") {
        // Hash: Use `kv.hset` (Hash)
        await kv.hset(key, value);
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
