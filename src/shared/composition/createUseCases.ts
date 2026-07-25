import type { PairRepository } from "@/src/modules/pair";
import {
  CreatePairUseCase,
  CreatePairsFromTransactionsUseCase,
  DeletePairUseCase,
  GetPairUseCase,
  ListPairsUseCase,
  UpdatePairSettingsUseCase,
} from "@/src/modules/pair";
import type { TransactionRepository } from "@/src/modules/transaction";
import {
  ClearOtherSideOrderUseCase,
  ImportTransactionsFromBinanceUseCase,
  ImportTransactionsFromLegacyCsvUseCase,
  ListOpenTransactionsUseCase,
  SetOtherSideOrderUseCase,
  UpdateTransactionNoteUseCase,
  UpdateTransactionTradeStyleUseCase,
} from "@/src/modules/transaction";
import type { TransactionGroupRepository } from "@/src/modules/transaction-group";
import {
  CreateTransactionGroupUseCase,
  DeleteTransactionGroupUseCase,
  ListTransactionGroupsUseCase,
} from "@/src/modules/transaction-group";

export type UseCaseRepositories = {
  pairRepository: PairRepository;
  transactionRepository: TransactionRepository;
  transactionGroupRepository: TransactionGroupRepository;
};

/**
 * Shared use-case wiring. Runtime-specific composition roots only choose the
 * repository adapters, so Redis can later be replaced by Prisma/PostgreSQL
 * without changing application use cases.
 */
export function createUseCases({
  pairRepository,
  transactionRepository,
  transactionGroupRepository,
}: UseCaseRepositories) {
  return {
    clearOtherSideOrder: new ClearOtherSideOrderUseCase(transactionRepository),
    createPair: new CreatePairUseCase(pairRepository),
    createPairsFromTransactions: new CreatePairsFromTransactionsUseCase(
      pairRepository,
      transactionRepository
    ),
    createTransactionGroup: new CreateTransactionGroupUseCase(
      transactionGroupRepository,
      transactionRepository
    ),
    deletePair: new DeletePairUseCase(pairRepository),
    deleteTransactionGroup: new DeleteTransactionGroupUseCase(
      transactionGroupRepository,
      transactionRepository
    ),
    getPair: new GetPairUseCase(pairRepository),
    importTransactionsFromBinance: new ImportTransactionsFromBinanceUseCase(
      transactionRepository,
      pairRepository
    ),
    importTransactionsFromLegacyCsv: new ImportTransactionsFromLegacyCsvUseCase(
      transactionRepository,
      pairRepository
    ),
    listOpenTransactions: new ListOpenTransactionsUseCase(transactionRepository),
    listPairs: new ListPairsUseCase(pairRepository),
    listTransactionGroups: new ListTransactionGroupsUseCase(
      transactionGroupRepository
    ),
    setOtherSideOrder: new SetOtherSideOrderUseCase(transactionRepository),
    updatePairSettings: new UpdatePairSettingsUseCase(pairRepository),
    updateTransactionNote: new UpdateTransactionNoteUseCase(transactionRepository),
    updateTransactionTradeStyle: new UpdateTransactionTradeStyleUseCase(
      transactionRepository
    ),
  } as const;
}
