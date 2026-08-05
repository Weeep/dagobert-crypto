import { LoginUseCase } from "@/src/modules/auth";
import type { AuthTokenService } from "@/src/modules/auth";
import { KvUserCredentialRepository } from "@/src/modules/auth/infrastructure/kv/KvUserCredentialRepository";
import { KvPairRepository } from "@/src/modules/pair/infrastructure/kv/KvPairRepository";
import { PrismaPairRepository } from "@/src/modules/pair/infrastructure/prisma/PrismaPairRepository";
import { KvTransactionRepository } from "@/src/modules/transaction/infrastructure/kv/KvTransactionRepository";
import { PrismaTransactionRepository } from "@/src/modules/transaction/infrastructure/prisma/PrismaTransactionRepository";
import { KvTransactionGroupRepository } from "@/src/modules/transaction-group/infrastructure/kv/KvTransactionGroupRepository";
import { PrismaTransactionGroupRepository } from "@/src/modules/transaction-group/infrastructure/prisma/PrismaTransactionGroupRepository";
import type { PrismaClient } from "@prisma/client";
import type { KeyValueStore } from "@/src/shared/infrastructure/kv/KeyValueStore";
import { createUseCases } from "./createUseCases";

/** Legacy KV-only server composition factory with an injectable persistence connection. */
export function createServerUseCases(
  store: KeyValueStore,
  tokenService: AuthTokenService
) {
  const repositories = createServerRepositories(store);
  return createServerUseCasesFromRepositories(repositories, tokenService);
}

export function createServerRepositories(store: KeyValueStore) {
  return {
    userCredentialRepository: new KvUserCredentialRepository(store),
    pairRepository: new KvPairRepository(store),
    transactionRepository: new KvTransactionRepository(store),
    transactionGroupRepository: new KvTransactionGroupRepository(store),
  };
}

export function createPrismaServerRepositories(
  prisma: PrismaClient,
  credentialStore: KeyValueStore
) {
  return {
    userCredentialRepository: new KvUserCredentialRepository(credentialStore),
    pairRepository: new PrismaPairRepository(prisma),
    transactionRepository: new PrismaTransactionRepository(prisma),
    transactionGroupRepository: new PrismaTransactionGroupRepository(prisma),
  };
}

type ServerRepositories =
  | ReturnType<typeof createServerRepositories>
  | ReturnType<typeof createPrismaServerRepositories>;

export function createServerUseCasesFromRepositories(
  repositories: ServerRepositories,
  tokenService: AuthTokenService
) {
  return {
    ...createUseCases(repositories),
    login: new LoginUseCase(repositories.userCredentialRepository, tokenService),
  } as const;
}
