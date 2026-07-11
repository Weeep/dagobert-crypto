import DbApiUtil from "@/utils/dbapiutil";
import type { ApiResponse } from "@/src/shared/dto/ApiResponse";
import type { DagobertTransactionGroup } from "@/src/modules/transaction-group";
import { KVRoot } from "@/src/shared/infrastructure/kv/KVRoot";
import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/utils/auth";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    // --- getTransactionGroups
    case "GET":
      const { id } = req.query;

      let dbResponse: ApiResponse;

      if (id) {
        dbResponse = await DbApiUtil.hget(
          KVRoot.dtransactionGroups,
          id as string
        );
      } else {
        dbResponse = await DbApiUtil.hgetall(KVRoot.dtransactionGroups);
      }

      if (dbResponse.ok) {
        const fetchedTransactionGroups = dbResponse.response
          ? dbResponse.response
          : {};

        if (id) {
          res.status(dbResponse.code).json(fetchedTransactionGroups);
        } else {
          // let filteredTransactionGroups: DagobertTransactionGroup[] =
          //   Object.values(
          //     fetchedTransactionGroups
          //   ) as DagobertTransactionGroup[];

          res.status(dbResponse.code).json(fetchedTransactionGroups);
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
