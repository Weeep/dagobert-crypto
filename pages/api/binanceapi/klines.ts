import type { NextApiRequest, NextApiResponse } from "next";
import binanceapiutils from "../../../utils/binanceapiutil";
import { ApiResponse } from "@/utils/typesAndEnums";
import { withAuth } from "@/utils/auth";
import Binance from "binance-api-node";

const apiKey: string = process.env.BAPI_KEY as string;
const apiSecret: string = process.env.BAPI_SEC as string;

async function klines(req: NextApiRequest, res: NextApiResponse) {
  //const client = Binance({ apiKey, apiSecret });
  //const ai = await client.allBookTickers(); //.prices({ symbol: "SOLUSDC" }); //.accountInfo();

  //return res.status(200).json(ai);

  const apiResponse: ApiResponse = await libKlines(req.query);
  if (apiResponse.ok) {
    res.status(apiResponse.code).json(apiResponse.response);
  } else {
    res.status(apiResponse.code).json({ error: apiResponse.error });
  }
}

export async function libKlines({
  symbol = "",
  interval = "",
  limit = "50",
}): Promise<ApiResponse> {
  let resultCode: number = 500;
  let resultBody: string = "";

  if (
    !symbol ||
    symbol === "" ||
    typeof symbol !== "string" ||
    !interval ||
    interval === "" ||
    typeof interval !== "string"
  ) {
    return {
      ok: false,
      code: 400,
      response: null,
      error: "Invalid symbol parameter",
    };
  }

  return binanceapiutils("klines", { symbol, interval, limit }, false, false);
}

export default withAuth(klines);
