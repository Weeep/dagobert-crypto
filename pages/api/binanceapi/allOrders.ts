import type { NextApiRequest, NextApiResponse } from "next";
import binanceapiutil from "../../../utils/binanceapiutil";
import { ApiResponse } from "@/utils/types";

export default async function allOrders(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const apiResponse: ApiResponse = await libAllOrders(req.query);
  if (apiResponse.ok) {
    res.status(apiResponse.code).json(JSON.stringify(apiResponse.response));
  } else {
    res.status(apiResponse.code).json({ error: apiResponse.error });
  }
}

export async function libAllOrders({
  symbol = "",
  startTime = "0",
}): Promise<ApiResponse> {
  let resultCode: number = 500;
  let resultBody: string = "";

  if (!symbol || symbol === "" || typeof symbol !== "string") {
    //resultCode = 400;
    //resultBody = '{error: "Invalid symbol parameter"}';
    return {
      ok: false,
      code: 400,
      response: null,
      error: "Invalid symbol parameter",
    };
    //////return { resultCode, resultBody };
  }

  return binanceapiutil("allOrders", { symbol, startTime });
}
