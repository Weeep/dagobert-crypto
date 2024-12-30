//import { kv } from "@vercel/kv";
import { ApiResponse } from "@/utils/types";
import { ukv as kv } from "../../../utils/dbapiutil";

import type { NextApiRequest, NextApiResponse } from "next";

interface ResponseIf {
  s: number;
  j: { message: string; action: string };
}

export default async function admin(req: NextApiRequest, res: NextApiResponse) {
  const connectionTest = async (action: string): Promise<ResponseIf> => {
    const badConnection = {
      s: 500,
      j: {
        message:
          "Database connection failed. It can be configuration, nameserver or temporary db issue.",
        action,
      },
    };

    let dbResponse: ApiResponse;

    dbResponse = await kv.lpush("listtest", { itemOne: "1", itemTwo: "2" });
    if (!dbResponse.ok) return badConnection;

    //dbResponse = await kv.lpush("listtest", { itemThree: "3", itemFour: "4" });
    //if (!dbResponse.ok) return badConnection;

    //dbResponse = await kv.hset("hashtest", { one: { two: "three" } });
    //if (!dbResponse.ok) return badConnection;

    dbResponse = await kv.del("listtest");
    if (!dbResponse.ok) return badConnection;

    //dbResponse = await kv.del("hashtest");
    //if (!dbResponse.ok) return badConnection;

    return { s: 200, j: { message: "Database connection OK", action } };
  };

  const flushDb = async (action: string): Promise<ResponseIf> => {
    if (action === "flushdb") {
      const r: any = await kv.flushdb();
      const lastUpdatedTime: any = await kv.get(
        "updated_time_of_last_processed_transaction"
      );
      return {
        s: 200,
        j: {
          message: `Database cleaned up? ${r["response"]}. Value of updated_time_of_last_processed_transaction: ${lastUpdatedTime}`,
          action,
        },
      };
    } else {
      return {
        s: 400,
        j: { message: "Error! Invalid action parameter", action },
      };
    }
  };

  const { action } = req.query;

  let act = "connectionTest";
  if (action && typeof action === "string") {
    act = action;
  }

  let s = 400;
  let j = { message: "Some issue..." };
  switch (act.toLowerCase()) {
    case "connectiontest":
      const connectionTestRes: ResponseIf = await connectionTest(act);
      ({ s, j } = connectionTestRes);
      break;
    case "flushdb":
      const flushDbRes: ResponseIf = await flushDb(act);
      ({ s, j } = flushDbRes);
      break;
    default:
      res.status(400).json({ error: "Invalid action parameter" });
  }

  res.status(s).json(j);
}
