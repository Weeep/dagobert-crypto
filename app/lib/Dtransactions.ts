import type { TransactionIf } from "@/app/lib/Interfaces";
import type { BnceTradeHisFromCsv } from "@/src/modules/transaction/dto/legacy/BnceTradeHisFromCsv";
import { KVRoot } from "@/src/shared/infrastructure/kv/KVRoot";
import type { DagobertTransaction } from "@/src/modules/transaction/domain/DagobertTransaction";
import { TradeStyle } from "@/src/modules/transaction/domain/TradeStyle";
import { TradeType } from "@/src/modules/transaction/domain/TradeType";
import { ImportTransactionsFromBinanceUseCase } from "@/src/modules/transaction/application/import-transactions/ImportTransactionsFromBinanceUseCase";
import { ImportTransactionsFromLegacyCsvUseCase } from "@/src/modules/transaction/application/import-transactions/ImportTransactionsFromLegacyCsvUseCase";
import type {
  ImportTransactionsResult,
  ImportTransactionsStoreResult,
} from "@/src/modules/transaction/application/import-transactions/ImportTransactionsResult";
import { ImportTransactionsStoreService } from "@/src/modules/transaction/application/import-transactions/ImportTransactionsStoreService";
import { ClientSideDbTransactionRepository } from "@/src/modules/transaction/infrastructure/ClientSideDbTransactionRepository";
import { ClientSideDbPairRepository } from "@/src/modules/pair/infrastructure/ClientSideDbPairRepository";
import {
  isBnceTradeHisFromCsvArray,
  isTransactionIfArray,
} from "@/utils/helper";

import ClientSideDbCache from "./ClientSideDbCache";

class Dtransactions {
  private static readonly transactionRepository =
    new ClientSideDbTransactionRepository();
  private static readonly pairRepository = new ClientSideDbPairRepository();
  private static readonly importTransactionsFromBinanceUseCase =
    new ImportTransactionsFromBinanceUseCase(
      Dtransactions.transactionRepository,
      Dtransactions.pairRepository
    );
  private static readonly importTransactionsFromLegacyCsvUseCase =
    new ImportTransactionsFromLegacyCsvUseCase(
      Dtransactions.transactionRepository,
      Dtransactions.pairRepository
    );

  static async post(
    data: TransactionIf[] | BnceTradeHisFromCsv[],
    tradeType: TradeType
  ): Promise<ImportTransactionsResult> {
    if (isTransactionIfArray(data)) {
      return this.importTransactionsFromBinanceUseCase.execute(
        data as TransactionIf[],
        tradeType
      );
    }

    if (isBnceTradeHisFromCsvArray(data)) {
      return this.importTransactionsFromLegacyCsvUseCase.execute(
        data as BnceTradeHisFromCsv[],
        tradeType
      );
    }

    return { ok: false, error: "Invalid input data", response: null };
  }

  static get(id: string): DagobertTransaction {
    return ClientSideDbCache.hget(
      KVRoot.dtransactions,
      id as string
    ) as DagobertTransaction;
  }

  static getAll(): DagobertTransaction[] {
    return Object.values(
      ClientSideDbCache.hgetall(KVRoot.dtransactions) ?? {}
    ) as DagobertTransaction[];
  }

  static getAllFilled(): DagobertTransaction[] {
    return this.getAll().filter((dtrans) => dtrans.status === "FILLED");
  }

  static async setStyleProperty(orderId: string, tradeStyle: TradeStyle) {
    return this.setProperty(orderId, "tradeStyle", tradeStyle);
  }

  private static async setProperty(
    orderId: string,
    propName: string,
    propValue: any
  ) {
    const dtg = this.get(orderId);
    await ClientSideDbCache.hset(KVRoot.dtransactions, {
      [dtg.orderId as string]: {
        ...dtg,
        ...{ [propName]: propValue },
      },
    });
  }

  private static async store(
    dtransactionsPerPair: Record<string, DagobertTransaction[]>,
    tradeType: TradeType,
    type: "binanceapi" | "binancecsv"
  ): Promise<ImportTransactionsStoreResult> {
    const storeService = new ImportTransactionsStoreService(
      this.transactionRepository,
      this.pairRepository
    );
    return storeService.store(dtransactionsPerPair, tradeType, type);
  }

  private static binanceApiOrdersToDTransactions(
    apiTransactions: TransactionIf[],
    tradeType: TradeType
  ): Record<string, DagobertTransaction[]> {
    return (
      Dtransactions.importTransactionsFromBinanceUseCase as any
    ).binanceApiOrdersToDTransactions(apiTransactions, tradeType);
  }

  private static binanceCsvFileToDTransactions(
    csvTransactions: BnceTradeHisFromCsv[],
    tradeType: TradeType
  ): Record<string, DagobertTransaction[]> {
    return (
      Dtransactions.importTransactionsFromLegacyCsvUseCase as any
    ).binanceCsvFileToDTransactions(csvTransactions, tradeType);
  }
}

export default Dtransactions;
