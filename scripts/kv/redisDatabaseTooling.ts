import Redis from "ioredis";

export type RedisDatabaseDump = Record<string, unknown>;

export interface RedisToolingClient {
  scan(cursor: string): Promise<[string, string[]]>;
  type(key: string): Promise<string>;
  get(key: string): Promise<string | null>;
  hgetall(key: string): Promise<Record<string, string>>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  smembers(key: string): Promise<string[]>;
  zrange(key: string, start: number, stop: number): Promise<string[]>;
  set(key: string, value: string): Promise<unknown>;
  sadd(key: string, ...members: string[]): Promise<unknown>;
  hset(key: string, ...fieldValues: string[]): Promise<unknown>;
  quit(): Promise<unknown>;
}

export type RedisToolingClientFactory = () => RedisToolingClient;

export function createRedisToolingClient(): RedisToolingClient {
  return new Redis({
    host: process.env.KV_HOST,
    port: Number(process.env.KV_PORT),
    password: process.env.KV_PASSWORD,
  });
}

export async function withRedisToolingClient<T>(
  operation: (redis: RedisToolingClient) => Promise<T>,
  clientFactory: RedisToolingClientFactory = createRedisToolingClient
): Promise<T> {
  const redis = clientFactory();
  try {
    return await operation(redis);
  } finally {
    await redis.quit();
  }
}

export async function exportRedisDatabase(
  redis: RedisToolingClient
): Promise<RedisDatabaseDump> {
  const dump: RedisDatabaseDump = {};
  let cursor = "0";

  do {
    const [nextCursor, keys] = await redis.scan(cursor);
    cursor = nextCursor;

    for (const key of keys) {
      const type = await redis.type(key);

      switch (type) {
        case "string":
          dump[key] = parseRedisString(await redis.get(key));
          break;
        case "hash":
          dump[key] = Object.fromEntries(
            Object.entries(await redis.hgetall(key)).map(([field, value]) => [
              field,
              parseJsonValue(value),
            ])
          );
          break;
        case "list":
          dump[key] = await redis.lrange(key, 0, -1);
          break;
        case "set":
          dump[key] = (await redis.smembers(key)).map(parseJsonValue);
          break;
        case "zset":
          dump[key] = await redis.zrange(key, 0, -1);
          break;
        default:
          console.warn(`Unsupported Redis type for key "${key}": ${type}`);
      }
    }
  } while (cursor !== "0");

  return dump;
}

export async function importRedisDatabase(
  redis: RedisToolingClient,
  dump: RedisDatabaseDump
): Promise<void> {
  for (const [key, value] of Object.entries(dump)) {
    if (typeof value === "string" || typeof value === "number") {
      await redis.set(key, String(value));
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length > 0) {
        await redis.sadd(key, ...value.map((item) => JSON.stringify(item)));
      }
      continue;
    }

    if (value && typeof value === "object") {
      const fieldValues = Object.entries(value).flatMap(([field, item]) => [
        field,
        typeof item === "string" ? item : JSON.stringify(item),
      ]);
      if (fieldValues.length > 0) {
        await redis.hset(key, ...fieldValues);
      }
      continue;
    }

    console.warn(`Unsupported value for key "${key}"; skipping it.`);
  }
}

function parseRedisString(value: string | null): string | number | null {
  if (value === null) return null;

  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? value : numberValue;
}

function parseJsonValue(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
