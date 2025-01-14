import { kv } from "@vercel/kv";
import { ApiResponse, KVRoot } from "./typesAndEnums";

class DbApiUtil {
  // private static cache: Record<string, any> = {};
  // private static isInitialized = false;

  // public static printCache(title: string = "cache") {
  //   console.log(title + ": " + JSON.stringify(this.cache).substring(0, 100));
  //   return title + ": " + JSON.stringify(this.cache).substring(0, 100);
  // }

  //static getCache(): Record<string, any> {
  //  return this.cache;
  //}

  public static async getCache(): Promise<{
    message: string;
    cache: Record<string, any>;
  }> {
    const cache: Record<string, any> = {};

    // Fetch all keys from the KV database
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
            cache[key] = await kv.get(key);
          } else if (type === "hash") {
            cache[key] = await kv.hgetall(key); // Fetch all fields in the hash
          } else if (type === "list") {
            cache[key] = await kv.lrange(key, 0, -1); // Fetch all elements in the list
          } else if (type === "set") {
            cache[key] = await kv.smembers(key); // Fetch all members of the set
          } else if (type === "zset") {
            cache[key] = await kv.zrange(key, 0, -1, { withScores: true }); // Fetch all members of the sorted set
          } else {
            console.warn(`Unknown type for key "${key}": ${type}`);
          }
        } catch (error) {
          console.error(`Error processing key "${key}":`, error);
        }
      }
    } while (cursor !== 0);

    console.log("Cache initialized at " + new Date().getTime() + "!"); //, this.cache["dtransactions"]);
    return { message: "Cache initialized!", cache };
  }

  // private static genCacheResponse(cacheData: any, input: any): ApiResponse {
  //   if (cacheData !== null) {
  //     return {
  //       ok: true,
  //       code: 200,
  //       response: cacheData,
  //       error: null,
  //     } as ApiResponse;
  //   } else {
  //     try {
  //       throw new Error("Cannot get data from cache: " + JSON.stringify(input));
  //     } catch (error) {
  //       return {
  //         ok: false,
  //         code: 500,
  //         response: null,
  //         error: (error as Error).message + "|" + (error as Error).stack,
  //       };
  //     }
  //   }
  // }

  private static async handleOperation<T>(
    operation: () => Promise<T>
  ): Promise<ApiResponse> {
    try {
      const res = await operation();
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

  // ADD

  public static async set(key: string, value: string): Promise<ApiResponse> {
    return this.handleOperation(() => kv.set(key, value));
  }

  public static async hset(
    key: KVRoot,
    kvObject: { [field: string]: any }
  ): Promise<ApiResponse> {
    return this.handleOperation(() => kv.hset(key, kvObject));
  }

  public static async sadd(key: KVRoot, item: any): Promise<ApiResponse> {
    return this.handleOperation(() => kv.sadd(key, item));
  }

  public static async lpush(key: string, value: object): Promise<ApiResponse> {
    return this.handleOperation(() => kv.lpush(key, value));
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

  public static async smembers(key: KVRoot): Promise<ApiResponse> {
    return this.handleOperation(() => kv.smembers(key));
  }

  // DEL

  public static async del(key: string): Promise<ApiResponse> {
    return this.handleOperation(() => kv.del(key));
  }

  public static async hdel(key: string, fields: string): Promise<ApiResponse> {
    return this.handleOperation(() => kv.hdel(key, fields));
  }

  public static async srem(key: KVRoot, item: any): Promise<ApiResponse> {
    return this.handleOperation(() => kv.srem(key, item));
  }

  // FLUSH

  public static async flushdb(): Promise<ApiResponse> {
    return this.handleOperation(() => kv.flushdb());
  }
}

export default DbApiUtil;
