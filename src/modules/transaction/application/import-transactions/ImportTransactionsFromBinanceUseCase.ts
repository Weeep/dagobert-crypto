import type { TransactionIf } from "@/app/lib/Interfaces";
import { getPrice, stringToRoundedFloat } from "@/utils/helper";
import type { PairRepository } from "@/src/modules/pair/domain/PairRepository";
import type { DagobertTransaction } from "../../domain/DagobertTransaction";
import type { TransactionRepository } from "../../domain/TransactionRepository";
import { TradeStyle } from "../../domain/TradeStyle";
import { TradeType } from "../../domain/TradeType";
import { v4 as uuidv4 } from "uuid";
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
      this.binanceApiOrdersToDTransactions(orders, tradeType),
      tradeType,
      "binanceapi"
    );

    return { ok: true, error: "", response: result };
  }

  private binanceApiOrdersToDTransactions(
    apiTransactions: TransactionIf[],
    tradeType: TradeType
  ): Record<string, DagobertTransaction[]> {
    const dtransactionsPerPair: Record<string, DagobertTransaction[]> = {};

    apiTransactions.forEach((apiTransaction) => {
      const cqq = stringToRoundedFloat(apiTransaction.cummulativeQuoteQty, 2);

      const dtransaction: DagobertTransaction = {
        orderId: uuidv4(),
        binanceApiId: apiTransaction.orderId,
        pair: apiTransaction.symbol,
        amount: apiTransaction.side === "SELL" ? cqq : 0 - cqq,
        dateEpoch: apiTransaction.updateTime - 61 * 60_000,
        date: new Date(apiTransaction.updateTime),
        side: apiTransaction.side,
        executed: stringToRoundedFloat(apiTransaction.executedQty),
        price: stringToRoundedFloat(
          getPrice(apiTransaction.cummulativeQuoteQty, apiTransaction.executedQty)
        ),
        status: apiTransaction.status,
        grouped: false,
        note: "",
        otherSideOrderId: "",
        tradeType,
        tradeStyle: TradeStyle.Swing,
      };

      dtransactionsPerPair[apiTransaction.symbol] =
        dtransactionsPerPair[apiTransaction.symbol] ?? [];
      dtransactionsPerPair[apiTransaction.symbol].push(dtransaction);
    });

    return dtransactionsPerPair;
  }
}
