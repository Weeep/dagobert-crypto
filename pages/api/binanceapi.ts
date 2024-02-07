import type { NextApiRequest, NextApiResponse } from "next";
import TransactionIf from "../../app/components/TransactionIf";

// Binance API doc
// https://binance-docs.github.io/apidocs/spot/en/#symbol-price-ticker

export default async function binanceapi(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { resultCode, resultBody } = await binanceapilib(req.query);
  res.status(resultCode).json(resultBody);
}

export async function binanceapilib({ symbol = "", startTime = "0" }) {
  let resultCode: number = 500;
  let resultBody: string = "";

  if (!symbol || symbol === "" || typeof symbol !== "string") {
    resultCode = 400;
    resultBody = '{error: "Invalid symbol parameter"}';
    return { resultCode, resultBody };
  }

  const apiKey: string = process.env.BAPI_KEY as string;
  const apiSecret: string = process.env.BAPI_SEC as string;

  let tryToFetch = true;
  let msCounter = 0;
  while (tryToFetch && msCounter <= 10) {
    let binanceUrl = "https://api.binance.com/api/v3/allOrders";
    const params: Record<string, any> = {
      symbol,
      startTime,
      timestamp: Math.floor(Date.now() + 5000 - msCounter * 1000),
    };
    //console.log(msCounter)
    msCounter++;

    const query = new URLSearchParams(params).toString();

    const sign = require("crypto")
      .createHmac("sha256", apiSecret)
      .update(query)
      .digest("hex");

    binanceUrl += `?${query}&signature=${sign}`;

    const header: RequestInit = {
      headers: {
        "Content-Type": "application/json",
        "X-MBX-APIKEY": apiKey,
      },
    };

    try {
      const binanceRes = await fetch(binanceUrl, header);

      const transactions = await binanceRes.json();
      tryToFetch = transactions?.code == -1021;

      resultCode = 200;
      resultBody = transactions;
    } catch (e: any) {
      tryToFetch = false;
      resultCode = e.response?.status || 500;
      resultBody = e.message;
    }
  }

  return {
    resultCode,
    resultBody:
      typeof resultBody !== "string" ? JSON.stringify(resultBody) : resultBody,
  };
}
