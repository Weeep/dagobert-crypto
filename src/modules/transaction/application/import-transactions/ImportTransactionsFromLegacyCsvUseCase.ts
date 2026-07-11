import { stringToRoundedFloat } from "@/utils/helper";
import type { PairRepository } from "@/src/modules/pair/domain/PairRepository";
import type { BnceTradeHisFromCsv } from "../../dto/legacy/BnceTradeHisFromCsv";
import type { DagobertTransaction } from "../../domain/DagobertTransaction";
import type { TransactionRepository } from "../../domain/TransactionRepository";
import { TradeStyle } from "../../domain/TradeStyle";
import { TradeType } from "../../domain/TradeType";
import { parse } from "date-fns";
import { v4 as uuidv4 } from "uuid";
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
      this.binanceCsvFileToDTransactions(csvRows, tradeType),
      tradeType,
      "binancecsv"
    );

    return { ok: true, error: "", response: result };
  }

  private binanceCsvFileToDTransactions(
    csvTransactions: BnceTradeHisFromCsv[],
    tradeType: TradeType
  ): Record<string, DagobertTransaction[]> {
    const dtransactionsPerPair: Record<string, DagobertTransaction[]> = {};

    csvTransactions.forEach((csvTrans) => {
      const parsedDate = parse(
        csvTrans["Date(UTC)"],
        "MM/dd/yyyy HH:mm",
        new Date()
      );
      const amount = stringToRoundedFloat(csvTrans.Amount, 2);

      const dtransaction: DagobertTransaction = {
        orderId: uuidv4(),
        binanceApiId: -1,
        pair: csvTrans.Pair,
        amount: csvTrans.Side === "SELL" ? amount : 0 - amount,
        dateEpoch: parsedDate.getTime(),
        date: parsedDate,
        side: csvTrans.Side,
        executed: stringToRoundedFloat(csvTrans.Executed),
        price: stringToRoundedFloat(csvTrans.Price),
        status: "FILLED",
        grouped: false,
        note: "",
        otherSideOrderId: "",
        tradeType,
        tradeStyle: TradeStyle.Swing,
      };

      dtransactionsPerPair[csvTrans.Pair] = dtransactionsPerPair[csvTrans.Pair] ?? [];
      dtransactionsPerPair[csvTrans.Pair].push(dtransaction);
    });

    return dtransactionsPerPair;
  }
}
