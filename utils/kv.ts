import Redis, { RedisKey } from "ioredis";
import { c } from "./debug";
import { KVRoot, ApiResponse } from "./typesAndEnums";

const redis = new Redis({
  host: process.env.KV_HOST,
  port: Number(process.env.KV_PORT),
  password: process.env.KV_PASSWORD,
});

export const kv = {
  //get: (key: string) => redis.get(key),
  set: (key: string, value: string) => redis.set(key, value),
  //del: (key: string) => redis.del(key),

  hset: (key: string, kvObject: { [field: string]: any }): Promise<number> => {
    const flatEntries: [string, string][] = Object.entries(kvObject).map(
      ([field, value]) => [
        field,
        typeof value === "string" ? value : JSON.stringify(value),
      ]
    );

    // flatten a [key1, val1, key2, val2, ...] alakra
    const args = flatEntries.flat();

    return redis.hset(key, ...args);
  },

  // hset: async (
  //   key: string,
  //   kvObject: { [field: string]: any }
  // ): Promise<number[]> => {
  //   // Végigmegyünk az összes field-en
  //   const result = [];
  //   for (const field in kvObject) {
  //     const value = JSON.stringify(kvObject[field]); // objektumokat stringgé alakítjuk
  //     result.push(await redis.hset(key, field, value));
  //   }
  //   return result;
  // },

  sadd: (key: KVRoot, item: any) => redis.sadd(key, JSON.stringify(item)),

  lpush: (key: string, value: object) =>
    redis.lpush(key, JSON.stringify(value)),

  // GET

  get: async (key: string): Promise<string | number | null> => {
    const raw = await redis.get(key);
    if (raw === null) return null;

    const num = Number(raw);
    return isNaN(num) ? raw : num;
  },

  hget: async (key: KVRoot, field: string): Promise<any> => {
    const raw = await redis.hget(key, field);

    if (raw === null) {
      return "null"; // TODO
    }

    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  },

  hgetall: async (key: KVRoot): Promise<Record<string, any>> => {
    const raw = await redis.hgetall(key);
    const parsed: Record<string, any> = {};

    for (const [field, value] of Object.entries(raw)) {
      try {
        parsed[field] = JSON.parse(value);
      } catch {
        parsed[field] = value;
      }
    }

    return parsed;
  },

  smembers: async (key: KVRoot): Promise<any[]> => {
    const raw = await redis.smembers(key);
    return raw.map((item) => {
      try {
        return JSON.parse(item);
      } catch {
        return item;
      }
    });
  },

  // DEL

  del: (key: string) => redis.del(key),

  hdel: (key: string, fields: string) => redis.hdel(key, fields),

  srem: (key: KVRoot, item: any) => redis.srem(key, item),

  // FLUSH

  flushdb: () => redis.flushdb(),

  // PRIVATE

  scan: (cursor: string) => redis.scan(cursor),

  type: (key: string) => redis.type(key),

  lrange: (key: string, start: number, stop: number) =>
    redis.lrange(key, start, stop),

  zrange: (
    key: string,
    start: number,
    stop: number /*,
    options?: { withScores: boolean }*/
  ) => redis.zrange(key, start, stop),
};
