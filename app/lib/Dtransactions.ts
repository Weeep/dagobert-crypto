import { TransactionIf } from "@/app/lib/Interfaces";
import {
  getPrice,
  isBnceTradeHisFromCsvArray,
  isTransactionIfArray,
  stringToRoundedFloat,
} from "@/utils/helper";
import { BnceTradeHisFromCsv, KVRoot } from "@/utils/typesAndEnums";
import type { DagobertTransaction } from "@/src/modules/transaction/domain/DagobertTransaction";
import { TradeStyle } from "@/src/modules/transaction/domain/TradeStyle";
import { TradeType } from "@/src/modules/transaction/domain/TradeType";
import { parse } from "date-fns";
import { v4 as uuidv4 } from "uuid";

import ClientSideDbCache from "./ClientSideDbCache";

class Dtransactions {
  static async post(
    data: TransactionIf[] | BnceTradeHisFromCsv[],
    tradeType: TradeType
  ): Promise<{
    ok: boolean;
    error: any;
    response: {
      pairInfo: {
        [key: string]: {
          processed: number;
          added: number;
          skipped: number;
        };
      };
      addedTransactions: any[];
    } | null;
  }> {
    if (isTransactionIfArray(data)) {
      const apiR = await this.store(
        this.binanceApiOrdersToDTransactions(
          data as TransactionIf[],
          tradeType
        ),
        tradeType,
        "binanceapi" //TODO
      );
      return { ok: true, error: "", response: apiR };
    } else if (isBnceTradeHisFromCsvArray(data)) {
      const csvR = await this.store(
        this.binanceCsvFileToDTransactions(
          data as BnceTradeHisFromCsv[],
          tradeType
        ),
        tradeType,
        "binancecsv" //TODO
      );
      return { ok: true, error: "", response: csvR };
    } else {
      return { ok: false, error: "Invalid input data", response: null };
    }

    // switch (type.toString().toLowerCase()) {
    //   case "binanceapi":
    //     //const d = JSON.parse(data);
    //     if (this.isBinanceApiData(data)) {
    //     } else {
    //       return { ok: false, error: "Invalid input data", response: null };
    //     }
    //   case "binancecsv":
    //     //const d = JSON.parse(data);
    //     if (this.isBinanceCsvData(data)) {
    //       const csvR = await this.store(
    //         binanceCsvFileToDTransactions(data as BnceTradeHisFromCsv[]),
    //         type.toString().toLowerCase()
    //       );
    //       return { ok: true, error: "", response: csvR };
    //     } else {
    //       return { ok: false, error: "Invalid input data", response: null };
    //     }
    //   default:
    //     return {
    //       ok: false,
    //       error: "Invalid 'type' parameter: " + type,
    //       response: null,
    //     };
    // }
  }

  static get(id: string): DagobertTransaction {
    return ClientSideDbCache.hget(
      KVRoot.dtransactions,
      id as string
    ) as DagobertTransaction;
  }

  static getAll(): DagobertTransaction[] {
    return Object.values(
      ClientSideDbCache.hgetall(KVRoot.dtransactions) //TODO handle null as in DTGroups
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
    //TODO error handling

    const dtg = this.get(orderId);
    await ClientSideDbCache.hset(KVRoot.dtransactions, {
      [dtg.orderId as string]: {
        ...dtg,
        ...{ [propName]: propValue },
      },
    });
  }

  private static async store(
    dtransactionsPerPair: {
      [pair: string]: DagobertTransaction[];
    },
    tradeType: TradeType,
    type: string
  ): Promise<{
    pairInfo: {
      [key: string]: { processed: number; added: number; skipped: number };
    };
    addedTransactions: DagobertTransaction[];
  }> {
    let info: {
      pairInfo: {
        [key: string]: { processed: number; added: number; skipped: number };
      };
      addedTransactions: DagobertTransaction[];
    } = { pairInfo: {}, addedTransactions: [] };

    // --- Sort new transactions by epoch and add new ones (newer date than last stored)
    for (const pair in dtransactionsPerPair) {
      info.pairInfo[pair] = info.pairInfo[pair] ?? {};
      info.pairInfo[pair].processed = info.pairInfo[pair].processed ?? 0;
      info.pairInfo[pair].added = info.pairInfo[pair].added ?? 0;
      info.pairInfo[pair].skipped = info.pairInfo[pair].skipped ?? 0;

      const dtransactions: DagobertTransaction[] = dtransactionsPerPair[pair];

      dtransactions.sort((a, b) => (a.dateEpoch > b.dateEpoch ? 1 : -1));
      for (let i = 0; i < dtransactions.length; i++) {
        const dtransaction: DagobertTransaction = dtransactions[i];

        if (
          dtransaction.status === "FILLED" &&
          (await this.epochNewerThanStored(
            type,
            dtransaction.pair,
            tradeType,
            dtransaction.dateEpoch
          ))
        ) {
          await ClientSideDbCache.hset(KVRoot.dtransactions, {
            [dtransaction.orderId]: dtransaction,
          });

          info.pairInfo[pair].added++;
          info.addedTransactions.push(dtransaction);
        } else {
          info.pairInfo[pair].skipped++;
        }
      }
      info.pairInfo[pair].processed = dtransactions.length;
      if (ClientSideDbCache.hget(KVRoot.pairs, pair) === null) {
        await ClientSideDbCache.hset(KVRoot.pairs, {
          [pair]: { pair: pair, decimals: 4 },
        });
      }
    }

    return info;
  }

  /**
   * @deprecated Binance CSV import is kept for backward compatibility only.
   * Prefer the Binance API order import path.
   */
  private static binanceCsvFileToDTransactions = (
    csvTransactions: BnceTradeHisFromCsv[],
    tradeType: TradeType
  ): { [pair: string]: DagobertTransaction[] } => {
    let dtransactionsPerPair: { [pair: string]: DagobertTransaction[] } = {};
    csvTransactions.map((csvTrans) => {
      const dateString = csvTrans["Date(UTC)"];
      const parsedDate = parse(dateString, "MM/dd/yyyy HH:mm", new Date());
      const parsedDateEpoch = parsedDate.getTime();
      const amount = stringToRoundedFloat(csvTrans.Amount, 2);

      const dtransaction: DagobertTransaction = {
        orderId: uuidv4(),
        binanceApiId: -1,
        pair: csvTrans.Pair,
        amount: csvTrans.Side === "SELL" ? amount : 0 - amount,
        dateEpoch: parsedDateEpoch,
        date: parsedDate,
        side: csvTrans.Side,
        executed: stringToRoundedFloat(csvTrans.Executed),
        price: stringToRoundedFloat(csvTrans.Price),
        status: "FILLED", // csv file contains FILLED only! (?)
        grouped: false,
        note: "",
        otherSideOrderId: "",
        tradeType,
        tradeStyle: TradeStyle.Swing,
      };

      dtransactionsPerPair[csvTrans.Pair] =
        dtransactionsPerPair[csvTrans.Pair] ?? [];
      dtransactionsPerPair[csvTrans.Pair].push(dtransaction);
    });

    return dtransactionsPerPair;
  };

  private static binanceApiOrdersToDTransactions = (
    apiTransactions: TransactionIf[],
    tradeType: TradeType
  ): { [pair: string]: DagobertTransaction[] } => {
    let dtransactionsPerPair: { [pair: string]: DagobertTransaction[] } = {};

    apiTransactions.map((apiTransaction) => {
      const cqq = stringToRoundedFloat(apiTransaction.cummulativeQuoteQty, 2);

      const dtransaction: DagobertTransaction = {
        orderId: uuidv4(),
        binanceApiId: apiTransaction.orderId,
        pair: apiTransaction.symbol,
        amount: apiTransaction.side === "SELL" ? cqq : 0 - cqq,
        dateEpoch: apiTransaction.updateTime - 60 * 60000 - 60000, // TODO -1 óra és 1 perc, hogy ne duplikálja a csv utolsó tranzakcióját
        date: new Date(apiTransaction.updateTime),
        side: apiTransaction.side,
        executed: stringToRoundedFloat(apiTransaction.executedQty),
        price: stringToRoundedFloat(
          getPrice(
            apiTransaction.cummulativeQuoteQty,
            apiTransaction.executedQty
          )
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
  };

  private static async epochNewerThanStored(
    type: string,
    pair: string,
    tradeType: TradeType,
    epoch: number
  ): Promise<boolean> {
    const lte = "last_transaction_epoch_" + tradeType + "_" + pair;

    const lastTransEpoch = ClientSideDbCache.get(lte);

    let epochUpdateNeeded = !lastTransEpoch;

    if (
      !epochUpdateNeeded &&
      type === "binanceapi" &&
      epoch > parseInt(lastTransEpoch)
    ) {
      epochUpdateNeeded = true;
    }

    if (
      !epochUpdateNeeded &&
      type !== "binanceapi" &&
      epoch >= parseInt(lastTransEpoch)
    ) {
      epochUpdateNeeded = true;
    }

    if (epochUpdateNeeded) {
      await ClientSideDbCache.set(lte, epoch.toString());
      return true;
    } else {
      return false;
    }
  }
}

export default Dtransactions;
