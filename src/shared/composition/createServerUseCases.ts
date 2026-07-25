import { LoginUseCase } from "@/src/modules/auth";
import type { AuthTokenService } from "@/src/modules/auth";
import { KvUserCredentialRepository } from "@/src/modules/auth/infrastructure/kv/KvUserCredentialRepository";
import { KvPairRepository } from "@/src/modules/pair/infrastructure/kv/KvPairRepository";
import { KvTransactionRepository } from "@/src/modules/transaction/infrastructure/kv/KvTransactionRepository";
import { KvTransactionGroupRepository } from "@/src/modules/transaction-group/infrastructure/kv/KvTransactionGroupRepository";
import type { KeyValueStore } from "@/src/shared/infrastructure/kv/KeyValueStore";
import { createUseCases } from "./createUseCases";

/** Server composition factory with an injectable persistence connection. */
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

export function createServerUseCasesFromRepositories(
  repositories: ReturnType<typeof createServerRepositories>,
  tokenService: AuthTokenService
) {
  return {
    ...createUseCases(repositories),
    login: new LoginUseCase(repositories.userCredentialRepository, tokenService),
  } as const;
}
