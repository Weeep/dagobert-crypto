import { ClientCachePairRepository } from "@/src/modules/pair/infrastructure/client-cache/ClientCachePairRepository";
import { HttpPairRepository } from "@/src/modules/pair/infrastructure/http/HttpPairRepository";
import { ClientCacheTransactionRepository } from "@/src/modules/transaction/infrastructure/client-cache/ClientCacheTransactionRepository";
import { HttpTransactionRepository } from "@/src/modules/transaction/infrastructure/http/HttpTransactionRepository";
import { ClientCacheTransactionGroupRepository } from "@/src/modules/transaction-group/infrastructure/client-cache/ClientCacheTransactionGroupRepository";
import { HttpTransactionGroupRepository } from "@/src/modules/transaction-group/infrastructure/http/HttpTransactionGroupRepository";
import {
  HttpReadClient,
  type FetchLike,
} from "../infrastructure/http/HttpReadClient";
import { createUseCases } from "./createUseCases";

/** Browser root: server-backed reads with temporary cache-backed writes. */
export function createClientUseCases(fetchImplementation: FetchLike = globalThis.fetch) {
  const http = new HttpReadClient(fetchImplementation);

  return createUseCases({
    pairRepository: new HttpPairRepository(http, new ClientCachePairRepository()),
    transactionRepository: new HttpTransactionRepository(
      http,
      new ClientCacheTransactionRepository()
    ),
    transactionGroupRepository: new HttpTransactionGroupRepository(
      http,
      new ClientCacheTransactionGroupRepository()
    ),
  });
}

export const clientUseCases = createClientUseCases();
