import type { PairRepository } from "@/src/modules/pair/domain/PairRepository";
import type { BnceTradeHisFromCsv } from "../../dto/legacy/BnceTradeHisFromCsv";
import type { TransactionRepository } from "../../domain/TransactionRepository";
import { TradeType } from "../../domain/TradeType";
import { legacyCsvRowsToTransactionsByPair } from "../mappers/legacyCsvRowToTransaction";
import type { ImportTransactionsResult } from "./ImportTransactionsResult";
import { ImportTransactionsStoreService } from "./ImportTransactionsStoreService";

export class ImportTransactionsFromLegacyCsvUseCase {
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
    csvRows: BnceTradeHisFromCsv[],
    tradeType: TradeType
  ): Promise<ImportTransactionsResult> {
    const result = await this.storeService.store(
      legacyCsvRowsToTransactionsByPair(csvRows, tradeType),
      tradeType,
      "binancecsv"
    );

    return { ok: true, error: "", response: result };
  }
}
