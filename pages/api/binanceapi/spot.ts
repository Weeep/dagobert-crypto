import type { NextApiRequest, NextApiResponse } from "next";
import { binanceClient } from "../../../utils/binanceapiutil";
import { withAuth } from "@/utils/auth";
import {
  CancelOrderOptions,
  CancelOrderResult,
  MyTrade,
  NewOrderLimit,
  NewOrderSL,
  NewOrderSpot,
  OrderType,
  QueryOrderResult,
} from "binance-api-node";

enum SpotActions {
  OpenOrders = "OpenOrders",
  CancelOrder = "CancelOrder",
  NewSlOrder = "NewSlOrder",
  AllOrders = "AllOrders",
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  let action = null;
  switch (req.method) {
    case "GET":
      action = req.query?.action;
      break;
    case "POST":
      action = SpotActions.NewSlOrder;
      break;
    case "DELETE":
      action = SpotActions.CancelOrder;
      break;
  }

  if (!action || !isValidAction(action)) {
    return res
      .status(400)
      .json({ error: "Invalid or missing action parameter: " + action });
  }

  switch (action) {
    case SpotActions.OpenOrders:
      return await openOrders(res, {});
    case SpotActions.CancelOrder:
      return await cancelOrder(res, req.body as CancelOrderOptions);
    case SpotActions.NewSlOrder:
      return await newStopLimitOrder(res, req.body);
    case SpotActions.AllOrders:
      return await allOrders(req, res);
  }
}

async function openOrders(
  res: NextApiResponse,
  options: {
    symbol?: string;
    recvWindow?: number;
    useServerTime?: boolean;
  }
) {
  try {
    const response: QueryOrderResult[] = await binanceClient.openOrders({
      ...options,
      useServerTime: true,
    });
    return res.status(200).json(response);
  } catch (err: any) {
    return res.status(500).json({
      error: `Error happened: ${err.message} | ${err?.response?.data}`,
    });
  }
}

async function cancelOrder(res: NextApiResponse, options: CancelOrderOptions) {
  try {
    if (
      //!options.orderId || <- TODO What? :O Why no such? It is mandatory!
      !options.symbol
    ) {
      return res.status(400).json({
        error: "One of the manadatory parameters missing (symbol, orderId)",
      });
    }

    const response: CancelOrderResult = await binanceClient.cancelOrder({
      ...options,
      useServerTime: true,
    });

    return res.status(200).json(response);
  } catch (err: any) {
    console.error("ERROR", err);
    return res.status(500).json({ message: err?.message, error: err });
  }
}

async function newStopLimitOrder(
  res: NextApiResponse,
  newOrderSL: NewOrderSL | NewOrderLimit
) {
  try {
    if (
      !newOrderSL.type ||
      !newOrderSL.quantity ||
      !newOrderSL.price ||
      //!newOrderSL.stopPrice ||
      !newOrderSL.symbol ||
      !newOrderSL.side
    ) {
      return res.status(400).json({
        error:
          "One of the manadatory parameters missing (type, quantity, price, stopPrice, symbol, side)",
      });
    }

    const response = await binanceClient.order({
      ...newOrderSL,
      useServerTime: true,
    }); //.orderTest(newOrderSL);
    return res.status(200).json(response); //response is empty, maybe a bug in order?
  } catch (err: any) {
    return res.status(500).json({
      error: `${err.message}${
        err?.response?.data ? " | " + err.response.data : ""
      }`,
    });
  }
}

async function allOrders(req: NextApiRequest, res: NextApiResponse) {
  if (!req.query.symbol) {
    return res.status(400).json("symbol is mandatory parameter.");
  }

  const queryOrderResult: QueryOrderResult[] = await binanceClient.allOrders({
    symbol: req.query.symbol as string,
    useServerTime: true,
  });
  if (queryOrderResult) {
    return res.status(200).json(queryOrderResult);
  } else {
    return res.status(500).json("Error: no response from allOrders endpoint");
  }
}

const isValidAction = (value: any): value is SpotActions => {
  return Object.values(SpotActions).includes(value as SpotActions);
};

export default withAuth(handler);
