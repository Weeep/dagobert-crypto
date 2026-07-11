import type { TransactionIf } from "@/app/lib/Interfaces";
import type { PairRepository } from "@/src/modules/pair/domain/PairRepository";
import type { TransactionRepository } from "../../domain/TransactionRepository";
import { TradeType } from "../../domain/TradeType";
import { binanceOrdersToTransactionsByPair } from "../mappers/binanceOrderToTransaction";
import type { ImportTransactionsResult } from "./ImportTransactionsResult";
import { ImportTransactionsStoreService } from "./ImportTransactionsStoreService";

export class ImportTransactionsFromBinanceUseCase {
  private readonly storeService: ImportTransactionsStoreService;

  constructor(
    transactionRepository: TransactionRepository,
    pairRepository: PairRepository
  ) {
    this.storeService = new ImportTransactionsStoreService(
      transactionRepository,
      pairRepository
    );
  }

  async execute(
    orders: TransactionIf[],
    tradeType: TradeType
  ): Promise<ImportTransactionsResult> {
    const result = await this.storeService.store(
      binanceOrdersToTransactionsByPair(orders, tradeType),
      tradeType,
      "binanceapi"
    );

    return { ok: true, error: "", response: result };
  }
}
