import { TransactionIf } from "@/app/lib/Interfaces";
import {
  binanceApiOrdersToDTransactions,
  binanceCsvFileToDTransactions,
} from "@/utils/helper";
import {
  BnceTradeHisFromCsv,
  DagobertTransaction,
  KVRoot,
} from "@/utils/typesAndEnums";
import ClientSideDbCache from "./ClientSideDbCache";

class Dtransactions {
  static async post(
    type: string,
    data: any[]
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
    //switch (method) {
    // --- setTransactions
    //case "POST":
    //const { type, data } = req.body;

    //if (!type || !data) {
    //  return []; //res.status(400).json({ error: "Missing data" });
    // }

    //let r = { s: 0, j: {} };
    switch (type.toString().toLowerCase()) {
      case "binanceapi":
        //const d = JSON.parse(data);
        if (this.isBinanceApiData(data)) {
          const apiR = await this.store(
            binanceApiOrdersToDTransactions(data as TransactionIf[]),
            type.toString().toLowerCase()
          );
          return { ok: true, error: "", response: apiR };
        } else {
          return { ok: false, error: "Invalid input data", response: null };
        }
      case "binancecsv":
        //const d = JSON.parse(data);
        if (this.isBinanceCsvData(data)) {
          const csvR = await this.store(
            binanceCsvFileToDTransactions(data as BnceTradeHisFromCsv[]),
            type.toString().toLowerCase()
          );
          return { ok: true, error: "", response: csvR };
        } else {
          return { ok: false, error: "Invalid input data", response: null };
        }
      default:
        return {
          ok: false,
          error: "Invalid 'type' parameter: " + type,
          response: null,
        };
    }
  }

  static get(id: string): DagobertTransaction {
    return ClientSideDbCache.hget(
      KVRoot.dtransactions,
      id as string
    ) as DagobertTransaction;
  }

  static getAll(): { [key: string]: DagobertTransaction } {
    return ClientSideDbCache.hgetall(KVRoot.dtransactions) as {
      [key: string]: DagobertTransaction;
    };
  }

  static async store(
    dtransactionsPerPair: {
      [pair: string]: DagobertTransaction[];
    },
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

  static isBinanceCsvData(data: any) {
    return (
      data.length > 0 &&
      "Pair" in data[0] &&
      "Side" in data[0] &&
      "Date(UTC)" in data[0]
    );
  }

  static isBinanceApiData(data: any) {
    return (
      data.length > 0 &&
      "symbol" in data[0] &&
      "orderId" in data[0] &&
      "updateTime" in data[0]
    );
  }

  static async epochNewerThanStored(
    type: string,
    pair: string,
    epoch: number
  ): Promise<boolean> {
    const lastTransEpoch = ClientSideDbCache.get(
      "last_transaction_epoch_" + pair
    );

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
      await ClientSideDbCache.set(
        "last_transaction_epoch_" + pair,
        epoch.toString()
      );
      return true;
    } else {
      return false;
    }
  }
}

export default Dtransactions;
