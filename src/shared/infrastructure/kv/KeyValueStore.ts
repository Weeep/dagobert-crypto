import type { KVRoot } from "./KVRoot";

/**
 * Minimal server-side KV contract used by Redis repository adapters.
 *
 * Domain repository contracts remain the application boundary. This port only
 * prevents the Redis adapters from depending on the concrete connection class,
 * and makes them testable without opening a network connection.
 */
export interface KeyValueStore {
  get(key: string): Promise<string | number | null>;
  set(key: string, value: string): Promise<unknown>;
  hget(key: KVRoot, field: string): Promise<unknown>;
  hgetall(key: KVRoot): Promise<Record<string, unknown>>;
  hset(key: KVRoot, value: Record<string, unknown>): Promise<unknown>;
  hdel(key: string, field: string): Promise<unknown>;
}
