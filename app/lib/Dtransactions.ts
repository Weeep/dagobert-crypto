import { TransactionIf } from "@/app/lib/Interfaces";
import {
  binanceApiOrdersToDTransactions,
  binanceCsvFileToDTransactions,
  isBnceTradeHisFromCsvArray,
  isTransactionIfArray,
} from "@/utils/helper";
import {
  BnceTradeHisFromCsv,
  DagobertTransaction,
  KVRoot,
  TradeType,
} from "@/utils/typesAndEnums";
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
        binanceApiOrdersToDTransactions(data as TransactionIf[], tradeType),
        tradeType,
        "binanceapi" //TODO
      );
      return { ok: true, error: "", response: apiR };
    } else if (isBnceTradeHisFromCsvArray(data)) {
      const csvR = await this.store(
        binanceCsvFileToDTransactions(data as BnceTradeHisFromCsv[], tradeType),
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
          (await this.epochNewerThanStored(
            type,
            dtransaction.pair,
            tradeType,
            dtransaction.dateEpoch
          )) &&
          dtransaction.status === "FILLED"
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
      await ClientSideDbCache.sadd(KVRoot.pairs, pair);
    }

    return info;
  }

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
