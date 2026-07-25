import { RedisHealthCheck } from "@/src/shared/infrastructure/kv/RedisHealthCheck";
import { RedisKeyValueStore } from "@/src/shared/infrastructure/kv/RedisKeyValueStore";
import { createServerRepositories } from "./createServerUseCases";
import { createUseCases } from "./createUseCases";

/**
 * Server composition root. API routes can use the singleton today, while tests
 * can inject an in-memory store through the factory.
 */
const redisKeyValueStore = new RedisKeyValueStore({
  host: process.env.KV_HOST,
  port: Number(process.env.KV_PORT),
  password: process.env.KV_PASSWORD,
});

export const databaseHealthCheck = new RedisHealthCheck(redisKeyValueStore);
export const serverRepositories = createServerRepositories(redisKeyValueStore);
export const serverUseCases = createUseCases(serverRepositories);
