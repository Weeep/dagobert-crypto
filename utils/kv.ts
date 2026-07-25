import Redis from "ioredis";
import { KVRoot } from "@/src/shared/infrastructure/kv/KVRoot";

export class KV {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.KV_HOST,
      port: Number(process.env.KV_PORT),
      password: process.env.KV_PASSWORD,
    });
  }

  // for manual reinitialization
  public reconnect() {
    this.redis = new Redis({
      host: process.env.KV_HOST,
      port: Number(process.env.KV_PORT),
      password: process.env.KV_PASSWORD,
    });
  }

  public set(key: string, value: string) {
    return this.redis.set(key, value);
  }

  public hset(
    key: string,
    kvObject: { [field: string]: any }
  ): Promise<number> {
    const flatEntries: [string, string][] = Object.entries(kvObject).map(
      ([field, value]) => [
        field,
        typeof value === "string" ? value : JSON.stringify(value),
      ]
    );

    const args = flatEntries.flat();
    return this.redis.hset(key, ...args);
  }

  public sadd(key: KVRoot, item: any) {
    return this.redis.sadd(key, JSON.stringify(item));
  }

  public lpush(key: string, value: object) {
    return this.redis.lpush(key, JSON.stringify(value));
  }

  public async get(key: string): Promise<string | number | null> {
    const raw = await this.redis.get(key);
    if (raw === null) return null;

    const num = Number(raw);
    return isNaN(num) ? raw : num;
  }

  public async hget(key: KVRoot, field: string): Promise<any> {
    const raw = await this.redis.hget(key, field);
    if (raw === null) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  public async hgetall(key: KVRoot): Promise<Record<string, any>> {
    const raw = await this.redis.hgetall(key);
    const parsed: Record<string, any> = {};

    for (const [field, value] of Object.entries(raw)) {
      try {
        parsed[field] = JSON.parse(value);
      } catch {
        parsed[field] = value;
      }
    }

    return parsed;
  }

  public async smembers(key: KVRoot): Promise<any[]> {
    const raw = await this.redis.smembers(key);
    return raw.map((item) => {
      try {
        return JSON.parse(item);
      } catch {
        return item;
      }
    });
  }

  public del(key: string) {
    return this.redis.del(key);
  }

  public hdel(key: string, fields: string) {
    return this.redis.hdel(key, fields);
  }

  public srem(key: KVRoot, item: any) {
    return this.redis.srem(key, item);
  }

  public flushdb() {
    return this.redis.flushdb();
  }

  public scan(cursor: string) {
    return this.redis.scan(cursor);
  }

  public type(key: string) {
    return this.redis.type(key);
  }

  public lrange(key: string, start: number, stop: number) {
    return this.redis.lrange(key, start, stop);
  }

  public zrange(key: string, start: number, stop: number) {
    return this.redis.zrange(key, start, stop);
  }
}

export const kv = new KV();
