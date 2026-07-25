import { HttpPairRepository } from "@/src/modules/pair/infrastructure/http/HttpPairRepository";
import { HttpTransactionRepository } from "@/src/modules/transaction/infrastructure/http/HttpTransactionRepository";
import { HttpTransactionGroupRepository } from "@/src/modules/transaction-group/infrastructure/http/HttpTransactionGroupRepository";
import {
  HttpReadClient,
  type FetchLike,
} from "../infrastructure/http/HttpReadClient";
import { HttpWriteClient } from "../infrastructure/http/HttpWriteClient";
import { createUseCases } from "./createUseCases";

/** Browser root: all persistence goes through the authenticated server API. */
export function createClientUseCases(fetchImplementation: FetchLike = globalThis.fetch) {
  const http = new HttpReadClient(fetchImplementation);
  const writes = new HttpWriteClient(fetchImplementation);

  return createUseCases({
    pairRepository: new HttpPairRepository(http, writes),
    transactionRepository: new HttpTransactionRepository(http, writes),
    transactionGroupRepository: new HttpTransactionGroupRepository(http, writes),
  });
}

export const clientUseCases = createClientUseCases();
