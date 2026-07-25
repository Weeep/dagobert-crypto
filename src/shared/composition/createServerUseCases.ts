import { KvPairRepository } from "@/src/modules/pair/infrastructure/kv/KvPairRepository";
import { KvTransactionRepository } from "@/src/modules/transaction/infrastructure/kv/KvTransactionRepository";
import { KvTransactionGroupRepository } from "@/src/modules/transaction-group/infrastructure/kv/KvTransactionGroupRepository";
import type { KeyValueStore } from "@/src/shared/infrastructure/kv/KeyValueStore";
import { createUseCases } from "./createUseCases";

/** Server composition factory with an injectable persistence connection. */
export function createServerUseCases(store: KeyValueStore) {
  return createUseCases({
    pairRepository: new KvPairRepository(store),
    transactionRepository: new KvTransactionRepository(store),
    transactionGroupRepository: new KvTransactionGroupRepository(store),
  });
}
