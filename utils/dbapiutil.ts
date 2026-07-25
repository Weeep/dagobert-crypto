import { kv } from "./kv";
//import { kv } from "@vercel/kv";
import type { ApiResponse } from "@/src/shared/dto/ApiResponse";
import { KVRoot } from "@/src/shared/infrastructure/kv/KVRoot";
import fs from "fs/promises";

class DbApiUtil {
  public static async getCache(
    source: "kv" | "file" = "kv",
    filePath = "./vercel_kv_export.json"
  ): Promise<{
    message: string;
    cache: Record<string, any>;
  }> {
    const cache: Record<string, any> = {};

    if (source === "file") {
      try {
        const data = await fs.readFile(filePath, "utf-8");
        const parsed = JSON.parse(data);
        return {
          message: `Cache loaded from file: ${filePath}`,
          cache: parsed,
        };
      } catch (err) {
        console.error("Failed to read cache file:", err);
        throw new Error(`Failed to load cache from file: ${err}`);
      }
    }

    let cursor: string = "0";

    do {
      console.log("cursor: " + cursor);

      const scanRes = await this.scan(cursor);
      if (!scanRes.ok || !Array.isArray(scanRes.response)) {
        throw new Error("Failed to scan keys.");
      }

      const [nextCursor, keys] = scanRes.response;
      cursor = nextCursor;

      for (const key of keys) {
        try {
          const typeRes = await this.type(key);
          const type = typeRes.ok ? typeRes.response : null;

          if (!type) {
            console.warn(`Could not determine type for key "${key}"`);
            continue;
          }

          let valueRes: ApiResponse;

          switch (type) {
            case "string":
              valueRes = await this.get(key);
              break;
            case "hash":
              valueRes = await this.hgetall(key as KVRoot);
              break;
            case "list":
              valueRes = await this.lrange(key, 0, -1);
              break;
            case "set":
              valueRes = await this.smembers(key as KVRoot);
              break;
            case "zset":
              valueRes = await this.zrange(key, 0, -1); //, { withScores: true });
              break;
            default:
              console.warn(`Unknown type for key "${key}": ${type}`);
              continue;
          }

          if (valueRes.ok) {
            cache[key] = valueRes.response;
          } else {
            console.warn(
              `Failed to get value for key "${key}":`,
              valueRes.error
            );
          }
        } catch (error) {
          console.error(`Error processing key "${key}":`, error);
        }
      }
    } while (cursor !== "0");

    return { message: "Cache loaded from KV!", cache };
  }

  private static toKVRoot(value: string): KVRoot {
    if (Object.values(KVRoot).includes(value as KVRoot)) {
      return value as KVRoot;
    }
    throw new Error("Invalid KVRoot: " + value);
  }

  private static async retryOperation<T>(
    operation: () => Promise<T>,
    retries: number = 3,
    delayMs: number = 500
  ): Promise<T> {
    try {
      return await operation();
    } catch (err) {
      if (retries <= 0) {
        throw err;
      }
      await new Promise((res) => setTimeout(res, delayMs));
      console.log("DB connect retry: " + retries);
      kv.reconnect();
      return this.retryOperation(operation, retries - 1, delayMs * 3); // triple delay: exponential backoff
    }
  }

  private static async handleOperation<T>(
    operation: () => Promise<T>,
    retries = 3,
    delayMs = 300
  ): Promise<ApiResponse> {
    try {
      const res = await this.retryOperation(operation, retries, delayMs);
      return { ok: true, code: 200, response: res, error: null };
    } catch (e: any) {
      return {
        ok: false,
        code: e?.response?.status || 500,
        response: null,
        error:
          "Cannot connect to database! Reason: " + (e?.message || "Unknown"),
      };
    }
  }

  // GET

  public static async get(key: string): Promise<ApiResponse> {
    return this.handleOperation(() => kv.get(key));
  }

  public static async hget(key: KVRoot, field: string): Promise<ApiResponse> {
    return this.handleOperation(() => kv.hget(key, field));
  }

  public static async hgetall(key: KVRoot): Promise<ApiResponse> {
    return this.handleOperation(() => kv.hgetall(key));
  }

  private static async smembers(key: KVRoot): Promise<ApiResponse> {
    return this.handleOperation(() => kv.smembers(key));
  }

  // PRIVATE

  private static async scan(cursor: string): Promise<ApiResponse> {
    return this.handleOperation(() => kv.scan(cursor));
  }

  private static async type(key: string): Promise<ApiResponse> {
    return this.handleOperation(() => kv.type(key));
  }

  private static async lrange(
    key: string,
    start: number,
    stop: number
  ): Promise<ApiResponse> {
    return this.handleOperation(() => kv.lrange(key, start, stop));
  }

  private static async zrange(
    key: string,
    start: number,
    stop: number /*,
    options?: { withScores: boolean }*/
  ): Promise<ApiResponse> {
    return this.handleOperation(() => kv.zrange(key, start, stop)); //, options));
  }
}

export default DbApiUtil;
