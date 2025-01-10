import { TransactionIf } from "@/app/components/Interfaces";
import DbApiUtil from "@/utils/dbapiutil";
import {
  binanceApiOrdersToDTransactions,
  binanceCsvFileToDTransactions,
} from "@/utils/helper";
import {
  ApiResponse,
  BnceTradeHisFromCsv,
  DagobertTransaction,
  KVRoot,
} from "@/utils/typesAndEnums";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  switch (req.method) {
    // --- setTransactions
    case "POST":
      const { type, data } = req.body;

      if (!type || !data) {
        res.status(400).json({ error: "Missing data" });
      }

      let r = { s: 0, j: {} };
      switch (type.toString().toLowerCase()) {
        case "binanceapi":
          const d = JSON.parse(data);
          if (isBinanceApiData(d)) {
            r = await store(
              binanceApiOrdersToDTransactions(d as TransactionIf[])
            );
            res.status(r.s).json(r.j);
          } else {
            res.status(400).json({ error: "Invalid input data" });
          }
          break;
        case "binancecsv":
          //const d = JSON.parse(data);
          if (isBinanceCsvData(data)) {
            r = await store(
              binanceCsvFileToDTransactions(data as BnceTradeHisFromCsv[])
            );
            res.status(r.s).json(r.j);
          } else {
            res.status(400).json({ error: "Invalid input data" });
          }
          break;
        default:
          res.status(400).json({ error: "Invalid 'type' parameter" });
      }

    // --- getTransactions
    case "GET":
      const { id } = req.query;

      let dbResponse: ApiResponse;

      if (id) {
        dbResponse = await DbApiUtil.hget(KVRoot.dtransactions, id as string);
      } else {
        dbResponse = await DbApiUtil.hgetall(KVRoot.dtransactions);
      }

      if (dbResponse.ok) {
        const fetchedTransactions = dbResponse.response
          ? dbResponse.response
          : {};

        if (id) {
          res.status(dbResponse.code).json(fetchedTransactions);
        } else {
          let dtransactions: DagobertTransaction[] = Object.values(
            fetchedTransactions
          ) as DagobertTransaction[];

          // DEBUG
          //const aaa = filteredTransactions.filter((obj) => !("status" in obj));
          //console.log(JSON.stringify(aaa));

          //filteredTransactions = filteredTransactions.filter(
          //  (obj) => obj.status === "FILLED" && !obj.grouped
          //);

          res.status(dbResponse.code).json(dtransactions); //fetchedTransactions);
        }
      } else {
        res.status(dbResponse.code).json({ error: dbResponse.error });
      }
      break;

    // --- default
    default:
      res.status(405).json({ error: "Method not allowed" });
  }
}

const store = async (dtransactionsPerPair: {
  [pair: string]: DagobertTransaction[];
}) => {
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
        await epochNewerThanStored(dtransaction.pair, dtransaction.dateEpoch)
      ) {
        await DbApiUtil.hset(KVRoot.dtransactions, {
          [dtransaction.orderId]: dtransaction,
        });

        info.pairInfo[pair].added++;
        info.addedTransactions.push(dtransaction);
      } else {
        info.pairInfo[pair].skipped++;
      }
    }
    info.pairInfo[pair].processed = dtransactions.length;
    await DbApiUtil.sadd(KVRoot.pairs, pair);
  }

  return { s: 200, j: info };
};

const isBinanceCsvData = (data: any) => {
  return (
    data.length > 0 &&
    "Pair" in data[0] &&
    "Side" in data[0] &&
    "Date(UTC)" in data[0]
  );
};

const isBinanceApiData = (data: any) => {
  return (
    data.length > 0 &&
    "symbol" in data[0] &&
    "orderId" in data[0] &&
    "updateTime" in data[0]
  );
};

const epochNewerThanStored = async (
  pair: string,
  epoch: number
): Promise<boolean> => {
  const lastTransEpoch = (await DbApiUtil.get("last_transaction_epoch_" + pair))
    .response;

  if (lastTransEpoch === null || epoch >= parseInt(lastTransEpoch)) {
    await DbApiUtil.set("last_transaction_epoch_" + pair, epoch.toString());
    return true;
  } else {
    return false;
  }
};
