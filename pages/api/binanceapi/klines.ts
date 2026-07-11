import type { NextApiRequest, NextApiResponse } from "next";
import { binanceClient } from "../../../utils/binanceapiutil";
import { withAuth } from "@/utils/auth";
import { CandleChartResult, CandlesOptions } from "binance-api-node";

const apiKey: string = process.env.BAPI_KEY as string;
const apiSecret: string = process.env.BAPI_SEC as string;

async function klines(req: NextApiRequest, res: NextApiResponse) {
  const { symbol, interval, limit = 50 } = req.query;

  if (
    !symbol ||
    symbol === "" ||
    typeof symbol !== "string" ||
    !interval ||
    interval === "" ||
    typeof interval !== "string"
  ) {
    return res
      .status(400)
      .json("Missing mandatory parameter: symbol or/and interval");
  }

  try {
    const response: CandleChartResult[] = await binanceClient.candles({
      symbol,
      interval,
      limit,
      //useServerTime: true,
    } as CandlesOptions);

    return res.status(200).json(response);
  } catch (error: any) {
    return res
      .status(500)
      .json({ message: error.message, error: JSON.stringify(error) });
  }
}

export default withAuth(klines);
