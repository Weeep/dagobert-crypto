import type { NextApiRequest, NextApiResponse } from "next";
import binanceapiutil from "../../../utils/binanceapiutil";

export default async function allOrders(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { resultCode, resultBody } = await libAllOrders(req.query);
  res.status(resultCode).json(resultBody);
}

export async function libAllOrders({ symbol = "", startTime = "0" }) {
  let resultCode: number = 500;
  let resultBody: string = "";

  if (!symbol || symbol === "" || typeof symbol !== "string") {
    resultCode = 400;
    resultBody = '{error: "Invalid symbol parameter"}';
    return { resultCode, resultBody };
  }

  return binanceapiutil("allOrders", { symbol, startTime });
}
