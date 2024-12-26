import type { NextApiRequest, NextApiResponse } from "next";
import binanceapiutils from "../../../utils/binanceapiutil";

export default async function klines(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { resultCode, resultBody } = await libKlines(req.query);
  res.status(resultCode).json(resultBody);
}

export async function libKlines({ symbol = "", interval = "" }) {
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
    resultCode = 400;
    resultBody = '{error: "Invalid symbol parameter"}';
    return { resultCode, resultBody };
  }

  return binanceapiutils("klines", { symbol, interval }, false, false);
}
