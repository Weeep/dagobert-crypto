import { JwtAuthTokenService } from "@/src/modules/auth/infrastructure/JwtAuthTokenService";
import { RedisKeyValueStore } from "@/src/shared/infrastructure/kv/RedisKeyValueStore";
import { PrismaHealthCheck } from "@/src/shared/infrastructure/prisma/PrismaHealthCheck";
import { prisma } from "@/src/shared/infrastructure/prisma/prisma";
import { PrismaPairRepository } from "@/src/modules/pair/infrastructure/prisma/PrismaPairRepository";
import { PrismaTransactionRepository } from "@/src/modules/transaction/infrastructure/prisma/PrismaTransactionRepository";
import { PrismaTransactionGroupRepository } from "@/src/modules/transaction-group/infrastructure/prisma/PrismaTransactionGroupRepository";
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
export const postgresReadRepositories = {
  pairRepository: new PrismaPairRepository(prisma),
  transactionRepository: new PrismaTransactionRepository(prisma),
  transactionGroupRepository: new PrismaTransactionGroupRepository(prisma),
};
export const postgresReadUseCases = createUseCases(postgresReadRepositories);
