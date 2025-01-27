import type { NextApiRequest, NextApiResponse } from "next";
import { binanceClient } from "../../../utils/binanceapiutil";
import { withAuth } from "@/utils/auth";
import {
  CancelOrderOptions,
  CancelOrderResult,
  HttpMethod,
  MyTrade,
  NewOrderSL,
  NewOrderSpot,
  OrderType,
  QueryOrderResult,
} from "binance-api-node";

enum MarginActions {
  OpenOrders = "OpenOrders",
  CancelOrder = "CancelOrder",
  NewSlOrder = "NewSlOrder",
  AllOrders = "AllOrders",
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!req.query.symbol) {
    return res.status(400).json("symbol is mandatory parameter.");
  }

  try {
    const marginOrders = await binanceClient.marginAllOrders({
      symbol: req.query.symbol as string,
      useServerTime: true,
    });

    if (marginOrders) {
      return res.status(200).json(marginOrders);
    } else {
      return res.status(500).json("Error: no response from allOrders endpoint");
    }
  } catch (error: any) {
    return res.status(500).json({ message: error?.message, error: error });
    //console.error("Error fetching margin order history:", error);
  }
}

export default withAuth(handler);
