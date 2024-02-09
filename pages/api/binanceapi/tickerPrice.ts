import type { NextApiRequest, NextApiResponse } from "next";
import binanceapiutils from "../../../utils/binanceapiutil";

export default async function allOrders(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { resultCode, resultBody } = await libAllOrders(req.query);
  res.status(resultCode).json(resultBody);
}

export async function libAllOrders({ symbols = "" }) {
  let resultCode: number = 500;
  let resultBody: string = "";

  if (!symbols || symbols === "" || typeof symbols !== "string") {
    resultCode = 400;
    resultBody = '{error: "Invalid symbol parameter"}';
    return { resultCode, resultBody };
  }

  return binanceapiutils("ticker/price", { symbols }, false, false);
}
