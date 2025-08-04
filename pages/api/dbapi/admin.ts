import { ApiResponse, DbActionsViaApi, KVRoot } from "@/utils/typesAndEnums";
import DbApiUtil from "../../../utils/dbapiutil";
import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/utils/auth";

interface ResponseIf {
  s: number;
  j: { response: any; action: string };
}

async function admin(req: NextApiRequest, res: NextApiResponse) {
  const connectionTest = async (action: string): Promise<ResponseIf> => {
    let dbResponse: ApiResponse;

    dbResponse = await DbApiUtil.lpush("listtest", {
      itemOne: "1",
      itemTwo: "2",
    });
    console.log("1");
    console.log(JSON.stringify(dbResponse));
    if (!dbResponse.ok) return getBadConnection(dbResponse, action);

    dbResponse = await DbApiUtil.del("listtest");
    console.log("2");
    console.log(JSON.stringify(dbResponse));
    if (!dbResponse.ok) return getBadConnection(dbResponse, action);

    return { s: 200, j: { response: "Database connection OK", action } };
  };

  const getBadConnection = async (
    response: ApiResponse,
    action: string
  ): Promise<ResponseIf> => {
    return { s: response.code, j: { response: response.error, action } };
  };

  const flushDb = async (action: string): Promise<ResponseIf> => {
    if (action === "flushdb") {
      const r: any = await DbApiUtil.flushdb();
      const lastUpdatedTime: any = await DbApiUtil.get(
        "updated_time_of_last_processed_transaction"
      );
      return {
        s: 200,
        j: {
          response: `Database cleaned up? ${r["response"]}. Value of updated_time_of_last_processed_transaction: ${lastUpdatedTime}`,
          action,
        },
      };
    } else {
      return {
        s: 400,
        j: { response: "Error! Invalid action parameter", action },
      };
    }
  };

  const getCacheFromKV = async (action: string): Promise<ResponseIf> => {
    const cache = await DbApiUtil.getCache("kv");
    return { s: 200, j: { response: cache, action } };
  };

  const getCacheFromFile = async (action: string): Promise<ResponseIf> => {
    const cache = await DbApiUtil.getCache("file");
    return { s: 200, j: { response: cache, action } };
  };

  const apiResponseToResponseIf = (
    response: ApiResponse,
    action: string
  ): ResponseIf => {
    return {
      s: response.code,
      j: { response: JSON.stringify(response.response), action },
    };
  };

  const dbOp = async (
    action: string,
    key: KVRoot | string,
    value: any
  ): Promise<ResponseIf> => {
    try {
      switch (action) {
        case "set":
          const setRes: ApiResponse = await DbApiUtil.set(key, value);
          return apiResponseToResponseIf(setRes, action);
        case "hset":
          let valueObj = value;
          if (typeof value === "string") {
            valueObj = JSON.parse(value);
          }

          // TODO should check that valueObj's type is {field: string]: DagobertTransaction;}

          const hsetRes: ApiResponse = await DbApiUtil.hset(
            key as KVRoot,
            valueObj
          );
          return apiResponseToResponseIf(hsetRes, action);
        case "sadd":
          const saddRes: ApiResponse = await DbApiUtil.sadd(
            key as KVRoot,
            value
          );
          return apiResponseToResponseIf(saddRes, action);
        case "del":
          const delRes: ApiResponse = await DbApiUtil.del(key);
          return apiResponseToResponseIf(delRes, action);
        case "hdel":
          const hdelRes: ApiResponse = await DbApiUtil.hdel(key, value);
          return apiResponseToResponseIf(hdelRes, action);
        case "srem":
          const sremRes: ApiResponse = await DbApiUtil.srem(
            key as KVRoot,
            value
          );
          return apiResponseToResponseIf(sremRes, action);
        default:
          throw new Error("Invalid dbOp action: " + action);
      }
    } catch (error) {
      return {
        s: 400,
        j: { response: JSON.stringify(error), action },
      };
    }
  };

  const isKVRootValue = (value: any): value is KVRoot => {
    return Object.values(KVRoot).includes(value as KVRoot);
  };

  const isDbActionsViaApiValue = (value: any): value is DbActionsViaApi => {
    return Object.values(DbActionsViaApi).includes(value as DbActionsViaApi);
  };

  //// --- Functions End ////////////////////

  const { action, key, value } = req.query;

  if (
    action !== DbActionsViaApi.connectiontest &&
    action !== DbActionsViaApi.flushdb &&
    action !== DbActionsViaApi.getcache &&
    action !== DbActionsViaApi.set //TODO: && 'del' but 'del' not used yet
  ) {
    //TODO
    if (key === null || key === undefined || !isKVRootValue(key))
      res.status(400).json({ error: `Invalid key parameter: ${key}` });
  }

  let act: DbActionsViaApi = DbActionsViaApi.connectiontest;
  if (action && isDbActionsViaApiValue(action)) {
    act = action;
  }

  let s = 400;
  let j = { response: "Some issue..." };
  switch (act) {
    case DbActionsViaApi.connectiontest:
      const connectionTestRes: ResponseIf = await connectionTest(act);
      ({ s, j } = connectionTestRes);
      break;
    case DbActionsViaApi.flushdb:
      const flushDbRes: ResponseIf = await flushDb(act);
      ({ s, j } = flushDbRes);
      break;
    case DbActionsViaApi.getcache:
      console.log(process.env.CACHE_SOURCE);
      const getCacheKVRes: ResponseIf =
        (process.env.CACHE_SOURCE as string) === "file"
          ? await getCacheFromFile(act)
          : await getCacheFromKV(act);
      ({ s, j } = getCacheKVRes);
      break;
    case DbActionsViaApi.set:
      ({ s, j } = await dbOp(act.toLowerCase(), key as string, value));
      break;
    case DbActionsViaApi.hset:
      ({ s, j } = await dbOp(act.toLowerCase(), key as KVRoot, value));
      break;
    case DbActionsViaApi.sadd:
      ({ s, j } = await dbOp(act.toLowerCase(), key as KVRoot, value));
      break;
    case DbActionsViaApi.del:
      ({ s, j } = await dbOp(act.toLowerCase(), key as KVRoot, value));
      break;
    case DbActionsViaApi.hdel:
      ({ s, j } = await dbOp(act.toLowerCase(), key as KVRoot, value));
      break;
    case DbActionsViaApi.srem:
      ({ s, j } = await dbOp(act.toLowerCase(), key as KVRoot, value));
      break;
    default:
      res.status(400).json({ error: "Invalid action parameter" });
  }

  res.status(s).json(j);
}

export default withAuth(admin);
