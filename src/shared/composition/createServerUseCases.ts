import { LoginUseCase } from "@/src/modules/auth";
import type {
  AuthTokenService,
  UserCredentialRepository,
} from "@/src/modules/auth";
import type { PairRepository } from "@/src/modules/pair";
import type { TransactionRepository } from "@/src/modules/transaction";
import type { TransactionGroupRepository } from "@/src/modules/transaction-group";
import { KvUserCredentialRepository } from "@/src/modules/auth/infrastructure/kv/KvUserCredentialRepository";
import { KvPairRepository } from "@/src/modules/pair/infrastructure/kv/KvPairRepository";
import { KvTransactionRepository } from "@/src/modules/transaction/infrastructure/kv/KvTransactionRepository";
import { KvTransactionGroupRepository } from "@/src/modules/transaction-group/infrastructure/kv/KvTransactionGroupRepository";
import type { KeyValueStore } from "@/src/shared/infrastructure/kv/KeyValueStore";
import { createUseCases } from "./createUseCases";

export type ServerRepositories = {
  userCredentialRepository: UserCredentialRepository;
  pairRepository: PairRepository;
  transactionRepository: TransactionRepository;
  transactionGroupRepository: TransactionGroupRepository;
};

/** Server composition factory with an injectable persistence connection. */
export function createServerUseCases(
  store: KeyValueStore,
  tokenService: AuthTokenService
) {
  const repositories = createServerRepositories(store);
  return createServerUseCasesFromRepositories(repositories, tokenService);
}

export function createServerRepositories(
  store: KeyValueStore
): ServerRepositories {
  return {
    userCredentialRepository: new KvUserCredentialRepository(store),
    pairRepository: new KvPairRepository(store),
    transactionRepository: new KvTransactionRepository(store),
    transactionGroupRepository: new KvTransactionGroupRepository(store),
  };
}

export function createServerUseCasesFromRepositories(
  repositories: ServerRepositories,
  tokenService: AuthTokenService
) {
  return {
    ...createUseCases(repositories),
    login: new LoginUseCase(repositories.userCredentialRepository, tokenService),
  } as const;
}
