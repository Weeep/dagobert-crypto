import type { NextApiRequest, NextApiResponse } from "next";
import { binanceClient } from "../../../utils/binanceapiutil";
import { withAuth } from "@/utils/auth";
import {
  CancelOrderOptions,
  CancelOrderResult,
  HttpMethod,
  MyTrade,
  NewOrderLimit,
  NewOrderSL,
  NewOrderSpot,
  OrderType,
  QueryOrderResult,
} from "binance-api-node";

enum MarginActions {
  OpenOrders = "OpenOrders",
  CancelOrder = "CancelOrder",
  NewTpOrder = "NewTpOrder",
  AllOrders = "AllOrders",
}

export function createMarginHandler(client = binanceClient) {
  return (req: NextApiRequest, res: NextApiResponse) => handler(req, res, client);
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
  client: typeof binanceClient
) {
  let action = null;
  switch (req.method) {
    case "GET":
      action = req.query?.action;
      break;
    case "POST":
      action = MarginActions.NewTpOrder;
      break;
    case "DELETE":
      action = MarginActions.CancelOrder;
      break;
  }

  if (!action || !isValidAction(action)) {
    return res
      .status(400)
      .json({ error: "Invalid or missing action parameter: " + action });
  }

  switch (action) {
    case MarginActions.OpenOrders:
      return await openOrders(res, {}, client);
    case MarginActions.CancelOrder:
      return await cancelOrder(res, req.body as CancelOrderOptions, client);
    case MarginActions.NewTpOrder:
      return await newOrder(res, req.body, client);
    case MarginActions.AllOrders:
      return await allOrders(req, res, client);
  }
}

async function allOrders(
  req: NextApiRequest,
  res: NextApiResponse,
  client: typeof binanceClient
) {
  if (!req.query.symbol) {
    return res.status(400).json("symbol is mandatory parameter.");
  }

  try {
    const marginOrders = await client.marginAllOrders({
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

async function cancelOrder(
  res: NextApiResponse,
  options: CancelOrderOptions,
  client: typeof binanceClient
) {
  try {
    if (
      //!options.orderId || <- TODO What? :O Why no such? It is mandatory!
      !options.symbol
    ) {
      return res.status(400).json({
        error: "One of the manadatory parameters missing (symbol, orderId)",
      });
    }

    const response: CancelOrderResult = await client.marginCancelOrder({
      ...options,
      useServerTime: true,
    });

    return res.status(200).json(response);
  } catch (err: any) {
    console.error("ERROR", err);
    return res.status(500).json({ message: err?.message, error: err });
  }
}

async function newOrder(
  res: NextApiResponse,
  order: NewOrderSL | NewOrderLimit, //TODO? as no NewOrderTP
  client: typeof binanceClient
) {
  try {
    if (
      !order.type ||
      !order.quantity ||
      !order.price ||
      //!order.stopPrice ||
      !order.symbol ||
      !order.side
    ) {
      return res.status(400).json({
        error:
          "One of the manadatory parameters missing (type, quantity, price, stopPrice, symbol, side)",
      });
    }

    const response = await client.marginOrder({
      ...order,
      useServerTime: true,
    });
    return res.status(200).json(response); //response is empty, maybe a bug in order?
  } catch (err: any) {
    return res.status(500).json({
      error: `${err.message}${
        err?.response?.data ? " | " + err.response.data : ""
      }`,
    });
  }
}

async function openOrders(
  res: NextApiResponse,
  options: { symbol?: string; recvWindow?: number; useServerTime?: boolean },
  client: typeof binanceClient
) {
  try {
    const response = await client.marginOpenOrders({
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

function isValidAction(value: any): value is MarginActions {
  return Object.values(MarginActions).includes(value as MarginActions);
}

export default withAuth(createMarginHandler());
