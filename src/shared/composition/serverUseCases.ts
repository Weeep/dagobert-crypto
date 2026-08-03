import { JwtAuthTokenService } from "@/src/modules/auth/infrastructure/JwtAuthTokenService";
import { RedisKeyValueStore } from "@/src/shared/infrastructure/kv/RedisKeyValueStore";
import { PrismaHealthCheck } from "@/src/shared/infrastructure/prisma/PrismaHealthCheck";
import { prisma } from "@/src/shared/infrastructure/prisma/prisma";
import { createPrismaReadRepositories } from "@/src/shared/infrastructure/prisma/PrismaReadRepositories";
import { createUseCases } from "./createUseCases";
import {
  createServerRepositories,
  createServerUseCasesFromRepositories,
} from "./createServerUseCases";

/**
 * Server composition root. API routes can use the singleton today, while tests
 * can inject an in-memory store through the factory.
 */
const redisKeyValueStore = new RedisKeyValueStore({
  host: process.env.KV_HOST,
  port: Number(process.env.KV_PORT),
  password: process.env.KV_PASSWORD,
});

export const databaseHealthCheck = new PrismaHealthCheck(prisma);
export const serverRepositories = createServerRepositories(redisKeyValueStore);
export const serverUseCases = createServerUseCasesFromRepositories(
  serverRepositories,
  new JwtAuthTokenService()
);

/** Temporary read-only PostgreSQL root used by the UI comparison switch. */
export const postgresReadRepositories = createPrismaReadRepositories(prisma);
export const postgresReadUseCases = createUseCases(postgresReadRepositories);
