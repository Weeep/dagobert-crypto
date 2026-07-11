import { withAuth } from "@/utils/auth";
import DbApiUtil from "@/utils/dbapiutil";
import type { ApiResponse } from "@/src/shared/dto/ApiResponse";
import type { DagobertTransaction } from "@/src/modules/transaction";
import { KVRoot } from "@/src/shared/infrastructure/kv/KVRoot";
import type { NextApiRequest, NextApiResponse } from "next";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
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

          //filteredTransactions = filteredTransactions.filter(
          //  (obj) => obj.status === "FILLED" && !obj.grouped
          //);

          res.status(dbResponse.code).json(dtransactions);
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

export default withAuth(handler);
