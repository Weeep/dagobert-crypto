import { ClientCachePairRepository } from "@/src/modules/pair/infrastructure/client-cache/ClientCachePairRepository";
import { ClientCacheTransactionRepository } from "@/src/modules/transaction/infrastructure/client-cache/ClientCacheTransactionRepository";
import { ClientCacheTransactionGroupRepository } from "@/src/modules/transaction-group/infrastructure/client-cache/ClientCacheTransactionGroupRepository";
import { createUseCases } from "./createUseCases";

const pairRepository = new ClientCachePairRepository();
const transactionRepository = new ClientCacheTransactionRepository();
const transactionGroupRepository = new ClientCacheTransactionGroupRepository();

/** Browser composition root. Kept separate from all server-only adapters. */
export const clientUseCases = createUseCases({
  pairRepository,
  transactionRepository,
  transactionGroupRepository,
});
