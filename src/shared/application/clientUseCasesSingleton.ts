import { KvPairRepository } from "@/src/modules/pair/infrastructure/kv/KvPairRepository";
import { CreatePairUseCase } from "@/src/modules/pair/application/create-pair/CreatePairUseCase";
import { CreatePairsFromTransactionsUseCase } from "@/src/modules/pair/application/create-pairs-from-transactions/CreatePairsFromTransactionsUseCase";
import { DeletePairUseCase } from "@/src/modules/pair/application/delete-pair/DeletePairUseCase";
import { GetPairUseCase } from "@/src/modules/pair/application/get-pair/GetPairUseCase";
import { ListPairsUseCase } from "@/src/modules/pair/application/list-pairs/ListPairsUseCase";
import { UpdatePairSettingsUseCase } from "@/src/modules/pair/application/update-pair-settings/UpdatePairSettingsUseCase";
import { KvTransactionRepository } from "@/src/modules/transaction/infrastructure/kv/KvTransactionRepository";
import { ClearOtherSideOrderUseCase } from "@/src/modules/transaction/application/clear-other-side-order/ClearOtherSideOrderUseCase";
import { ImportTransactionsFromBinanceUseCase } from "@/src/modules/transaction/application/import-transactions/ImportTransactionsFromBinanceUseCase";
import { ImportTransactionsFromLegacyCsvUseCase } from "@/src/modules/transaction/application/import-transactions/ImportTransactionsFromLegacyCsvUseCase";
import { ListOpenTransactionsUseCase } from "@/src/modules/transaction/application/list-open-transactions/ListOpenTransactionsUseCase";
import { SetOtherSideOrderUseCase } from "@/src/modules/transaction/application/set-other-side-order/SetOtherSideOrderUseCase";
import { UpdateTransactionNoteUseCase } from "@/src/modules/transaction/application/update-transaction-note/UpdateTransactionNoteUseCase";
import { UpdateTransactionTradeStyleUseCase } from "@/src/modules/transaction/application/update-transaction-trade-style/UpdateTransactionTradeStyleUseCase";
import { KvTransactionGroupRepository } from "@/src/modules/transaction-group/infrastructure/kv/KvTransactionGroupRepository";
import { CreateTransactionGroupUseCase } from "@/src/modules/transaction-group/application/create-transaction-group/CreateTransactionGroupUseCase";
import { DeleteTransactionGroupUseCase } from "@/src/modules/transaction-group/application/delete-transaction-group/DeleteTransactionGroupUseCase";
import { ListTransactionGroupsUseCase } from "@/src/modules/transaction-group/application/list-transaction-groups/ListTransactionGroupsUseCase";

const pairRepository = new KvPairRepository();
const transactionRepository = new KvTransactionRepository();
const transactionGroupRepository = new KvTransactionGroupRepository();

export const clientUseCasesSingleton = {
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
