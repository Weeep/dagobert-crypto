import { kv } from "@vercel/kv";
import { ApiResponse } from "./types";

class DbApiUtil {
  private async handleOperation<T>(
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

  async lpush(key: string, value: object): Promise<ApiResponse> {
    return this.handleOperation(() => kv.lpush(key, value));
  }

  async flushdb(): Promise<ApiResponse> {
    return this.handleOperation(() => kv.flushdb());
  }

  async get(key: string): Promise<ApiResponse> {
    return this.handleOperation(() => kv.get(key));
  }

  async hset(
    key: string,
    kvObject: { [field: string]: any }
  ): Promise<ApiResponse> {
    return this.handleOperation(() => kv.hset(key, kvObject));
  }

  async hget(key: string, field: string): Promise<ApiResponse> {
    return this.handleOperation(() => kv.hget(key, field));
  }

  async hgetall(key: string): Promise<ApiResponse> {
    return this.handleOperation(() => kv.hgetall(key));
  }

  async sadd(key: string, item: any): Promise<ApiResponse> {
    return this.handleOperation(() => kv.sadd(key, item));
  }

  async srem(key: string, item: any): Promise<ApiResponse> {
    return this.handleOperation(() => kv.srem(key, item));
  }

  async smembers(key: string): Promise<ApiResponse> {
    return this.handleOperation(() => kv.smembers(key));
  }

  async del(key: string): Promise<ApiResponse> {
    return this.handleOperation(() => kv.del(key));
  }
}

export const ukv = new DbApiUtil();
