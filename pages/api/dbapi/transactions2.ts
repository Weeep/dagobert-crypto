import { TransactionIf } from "@/app/components/Interfaces";
import { ukv } from "@/utils/dbapiutil";
import { getPrice, stringToRoundedFloat } from "@/utils/helper";
import { ApiResponse, DagobertTransaction } from "@/utils/types";
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

      const binanceApiOrdersToDTransactions = () => {
        let transactions = JSON.parse(data) as TransactionIf[]; // TODO !!!
        if (
          transactions.length > 0 &&
          transactions[0]?.orderId &&
          transactions[0]?.updateTime
        ) {
          transactions.map(async (bnceTransaction) => {
            const dbResp = await ukv.hget(
              "dtransactions",
              bnceTransaction.orderId.toString()
            );
            if (!dbResp.ok) {
              return { s: 400, j: { success: false } }; //TODO
            }

            console.log("rrrr|" + JSON.stringify(dbResp.response) + "|rrrrr");

            if (dbResp.response === null) {
              const cqq = stringToRoundedFloat(
                bnceTransaction.cummulativeQuoteQty,
                2
              );

              const dtransaction: DagobertTransaction = {
                orderId: bnceTransaction.orderId.toString(),
                pair: bnceTransaction.symbol,
                amount: bnceTransaction.side === "SELL" ? cqq : 0 - cqq,
                dateEpoch: bnceTransaction.updateTime,
                date: new Date(bnceTransaction.updateTime),
                side: bnceTransaction.side,
                executed: stringToRoundedFloat(bnceTransaction.executedQty),
                price: stringToRoundedFloat(
                  getPrice(
                    bnceTransaction.cummulativeQuoteQty,
                    bnceTransaction.executedQty
                  )
                ),
                status: bnceTransaction.status,
                grouped: false,
              };

              await ukv.hset("dtransactions", {
                [dtransaction.orderId]: dtransaction,
              });
            }
          });
          // TODO check it successfully done?
        }

        return { s: 200, j: { success: true } };
      };

      switch (type.toString().toLowerCase()) {
        case "binanceapi":
          const { s, j } = binanceApiOrdersToDTransactions();
          res.status(s).json(j);
          break;
        case "binancecsvfile":
          break;
        default:
          res.status(400).json({ error: "Invalid 'type' parameter" });
      }

    // --- getTransactions
    case "GET":
      const { id } = req.query;

      let dbResponse: ApiResponse;
      console.log(id);

      if (id) {
        dbResponse = await ukv.hget("dtransactions", id as string);
        console.log(JSON.stringify(dbResponse.response));
      } else {
        dbResponse = await ukv.hgetall("dtransactions");
      }

      if (dbResponse.ok) {
        const fetchedTransactions = dbResponse.response
          ? dbResponse.response
          : {};

        if (id) {
          res.status(dbResponse.code).json(fetchedTransactions);
        } else {
          let filteredTransactions: DagobertTransaction[] = Object.values(
            fetchedTransactions
          ) as DagobertTransaction[];

          filteredTransactions = filteredTransactions.filter(
            (obj) => obj.status === "FILLED" && !obj.grouped
          );

          res.status(dbResponse.code).json(filteredTransactions); //fetchedTransactions);
        }
      } else {
        res.status(dbResponse.code).json({ error: dbResponse.error });
      }
      break;

    // --- default
    default:
      res.status(405).json({ error: "Method not allowed" });
  }

  //if (req.method !== "POST") {
  //  return return res.status(405).json({ error: "Method not allowed" });
  //}
}
