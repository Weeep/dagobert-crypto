import Redis, { type RedisOptions } from "ioredis";
import type { KVRoot } from "./KVRoot";
import type { KeyValueStore } from "./KeyValueStore";

export type RedisConnectionOptions = Pick<
  RedisOptions,
  "host" | "port" | "password"
>;

type RedisClient = Pick<
  Redis,
  "get" | "set" | "hget" | "hgetall" | "hset" | "hdel"
>;

export type RedisClientFactory = (
  options: RedisConnectionOptions
) => RedisClient;

const createRedisClient: RedisClientFactory = (options) => new Redis(options);

/** ioredis-backed implementation of the server-side key-value store port. */
export class RedisKeyValueStore implements KeyValueStore {
  private readonly redis: RedisClient;

  constructor(
    options: RedisConnectionOptions,
    clientFactory: RedisClientFactory = createRedisClient
  ) {
    this.redis = clientFactory(options);
  }

  public async get(key: string): Promise<string | number | null> {
    const raw = await this.redis.get(key);
    if (raw === null) return null;

    const numberValue = Number(raw);
    return Number.isNaN(numberValue) ? raw : numberValue;
  }

  public set(key: string, value: string): Promise<unknown> {
    return this.redis.set(key, value);
  }

  public async hget(key: KVRoot, field: string): Promise<unknown> {
    const raw = await this.redis.hget(key, field);
    if (raw === null) return null;

    return this.parseValue(raw);
  }

  public async hgetall(key: KVRoot): Promise<Record<string, unknown>> {
    const raw = await this.redis.hgetall(key);
    return Object.fromEntries(
      Object.entries(raw).map(([field, value]) => [
        field,
        this.parseValue(value),
      ])
    );
  }

  public hset(
    key: KVRoot,
    value: Record<string, unknown>
  ): Promise<unknown> {
    const serializedEntries = Object.entries(value).map(([field, item]) => [
      field,
      typeof item === "string" ? item : JSON.stringify(item),
    ]);

    return this.redis.hset(key, ...serializedEntries.flat());
  }

  public hdel(key: string, field: string): Promise<unknown> {
    return this.redis.hdel(key, field);
  }

  private parseValue(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}
