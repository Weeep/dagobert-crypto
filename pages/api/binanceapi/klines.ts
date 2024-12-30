import type { NextApiRequest, NextApiResponse } from "next";
import binanceapiutils from "../../../utils/binanceapiutil";
import { ApiResponse } from "@/utils/types";

export default async function klines(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const apiResponse: ApiResponse = await libKlines(req.query);
  if (apiResponse.ok) {
    res.status(apiResponse.code).json(JSON.stringify(apiResponse.response));
  } else {
    res.status(apiResponse.code).json({ error: apiResponse.error });
  }
}

export async function libKlines({
  symbol = "",
  interval = "",
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

  return binanceapiutils("klines", { symbol, interval }, false, false);
}
