import { TransactionIf } from "@/app/components/Interfaces";
import { ukv } from "@/utils/dbapiutil";
import { ApiResponse } from "@/utils/types";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  switch (req.method) {
    // --- setTransactions
    case "POST":
      const { data } = req.body;

      if (!data) {
        res.status(400).json({ error: "Missing data" });
      }

      let transactions = JSON.parse(data) as TransactionIf[]; // TODO !!!
      if (
        transactions.length > 0 &&
        transactions[0]?.orderId &&
        transactions[0]?.updateTime
      ) {
        transactions.map(async (transaction) => {
          //transaction.grouped = false;
          await ukv.hset("transactions", {
            [transaction.orderId]: transaction,
          });
        });
        // TODO check it successfully done?
      }

      res.status(200).json({ success: true });
      break;

    // --- getTransactions
    case "GET":
      const { id } = req.query;

      let dbResponse: ApiResponse;
      console.log(id);

      if (id) {
        dbResponse = await ukv.hget("transactions", id as string);
        console.log(JSON.stringify(dbResponse.response));
      } else {
        dbResponse = await ukv.hgetall("transactions");
      }

      if (dbResponse.ok) {
        const fetchedTransactions = dbResponse.response
          ? dbResponse.response
          : {};

        if (id) {
          res.status(dbResponse.code).json(fetchedTransactions);
        } else {
          let filteredTransactions: TransactionIf[] = Object.values(
            fetchedTransactions
          ) as TransactionIf[];

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
