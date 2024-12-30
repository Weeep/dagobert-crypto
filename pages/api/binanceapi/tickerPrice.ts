import type { NextApiRequest, NextApiResponse } from "next";
import binanceapiutils from "../../../utils/binanceapiutil";
import { ApiResponse } from "@/utils/types";

export default async function allOrders(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const response: ApiResponse = await libAllOrders(req.query);
  if (response.ok) {
    res.status(response.code).json(JSON.stringify(response.response));
  } else {
    res.status(response.code).json({ error: response.error });
  }
}

export async function libAllOrders({ symbols = "" }): Promise<ApiResponse> {
  if (!symbols || symbols === "" || typeof symbols !== "string") {
    return {
      ok: false,
      code: 400,
      error: "Invalid symbol parameter",
      response: null,
    } as ApiResponse;
  }

  return binanceapiutils("ticker/price", { symbols }, false, false);
}
