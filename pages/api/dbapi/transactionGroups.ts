import { TransactionIf } from "@/app/components/Interfaces";
import { ukv } from "@/utils/dbapiutil";
import { ApiResponse, TransactionGroup } from "@/utils/types";
import type { NextApiRequest, NextApiResponse } from "next";
import { v4 as uuidv4 } from "uuid";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  switch (req.method) {
    // --- setTransactions
    case "POST":
      const { data } = req.body;

      if (!data || data === undefined) {
        //TODO true even it is undefined
        res.status(400).json({ error: "Missing data" });
      }

      let transactionGroups = data as TransactionGroup[]; // TODO !!!
      if (
        transactionGroups.length > 0 &&
        transactionGroups[0]?.pair &&
        transactionGroups[0]?.groupedTrans
      ) {
        transactionGroups.map(async (transactionGroup) => {
          for (const transaction of transactionGroup.groupedTrans) {
            const dbResp: ApiResponse = await ukv.hget(
              "transactions",
              transaction.orderId.toString()
            );
            const storedTransaction = dbResp.response;

            const newGroupedValue = { grouped: true };

            await ukv.hset("transactions", {
              [transaction.orderId]: {
                ...storedTransaction,
                ...newGroupedValue,
              },
            });
          }

          const gid = uuidv4();
          transactionGroup.groupId = gid;
          await ukv.hset("transactionGroup", { [gid]: transactionGroup });

          //await ukv.hset("transactions", {
          //  [transaction.orderId]: transaction,
          //});
        });
        // TODO check it successfully done?
      } else {
        console.log("csacsasas");
        res.status(400).json({ error: "Invalid data" });
      }

      res.status(200).json({ success: true });
      break;

    // --- getTransactions
    case "GET":
      const { id } = req.query;

      let dbResponse: ApiResponse;

      if (id) {
        dbResponse = await ukv.hget("transactionGroup", id as string);
      } else {
        dbResponse = await ukv.hgetall("transactionGroup");
      }

      if (dbResponse.ok) {
        const fetchedTransactionGroups = dbResponse.response
          ? dbResponse.response
          : {};

        if (id) {
          res.status(dbResponse.code).json(fetchedTransactionGroups);
        } else {
          let filteredTransactionGroups: TransactionGroup[] = Object.values(
            fetchedTransactionGroups
          ) as TransactionGroup[];

          res.status(dbResponse.code).json(filteredTransactionGroups);
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
