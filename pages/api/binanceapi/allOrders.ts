import type { NextApiRequest, NextApiResponse } from "next";
import binanceapiutil from "../../../utils/binanceapiutil";
import { ApiResponse } from "@/utils/typesAndEnums";
import { withAuth } from "@/utils/auth";
import Binance, {
  CancelOrderOptions,
  CancelOrderResult,
  MyTrade,
  NewOrderSL,
  NewOrderSpot,
  OrderType,
  QueryOrderResult,
} from "binance-api-node";

const apiKey: string = process.env.BAPI_KEY as string;
const apiSecret: string = process.env.BAPI_SEC as string;

enum Actions {
  Trades = "Trades",
  OpenOrders = "OpenOrders",
  CancelOrder = "CancelOrder",
  NewSlOrder = "NewSlOrder",
  AllOrders = "AllOrders", // TODO legacy, Trades should be used
}

const client = Binance({ apiKey, apiSecret });

function getTrades(options: {
  symbol: string;
  orderId?: number;
  startTime?: number;
  endTime?: number;
  fromId?: number;
  limit?: number;
  recvWindow?: number;
  useServerTime?: boolean;
}): Promise<MyTrade[]> {
  //QueryOrderResult[]> {
  try {
    //const symbol = "AVAXUSDT";

    return client.myTrades(options); //.openOrders(options);
  } catch (error: any) {
    return Promise.reject(
      error.response?.data || error.message || "Error fetching open orders"
    );
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  let action = null;
  switch (req.method) {
    case "GET":
      action = req.query?.action;
      break;
    case "POST":
      action = Actions.NewSlOrder;
      break;
    case "CANCEL":
      action = Actions.CancelOrder;
      break;
  }

  if (!action || !isValidAction(action)) {
    return res
      .status(400)
      .json({ error: "Invalid or missing action parameter: " + action });
  }

  switch (action) {
    case Actions.Trades:
      return res
        .status(400)
        .json({ error: "Action 'Trades' not supported yet." });
    case Actions.OpenOrders:
      return await openOrders(res, {});
    case Actions.CancelOrder:
      //TODO
      break;
    case Actions.NewSlOrder:
      return await newStopLimitOrder(res, req.body as NewOrderSL);
      break;
    case Actions.AllOrders:
      return await allOrders(req, res);
      break;
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
    const response: QueryOrderResult[] = await client.openOrders(options);
    return res.status(200).json(response);
  } catch (error: any) {
    return res
      .status(500)
      .json(`Error happened: ${error.message} | ${error?.response?.data}`);
  }
}

async function newStopLimitOrder(res: NextApiResponse, newOrderSL: NewOrderSL) {
  try {
    const response = await client.order(newOrderSL); //.orderTest(newOrderSL);
    return res.status(200).json(response); //response is empty, maybe a bug in order?
  } catch (error: any) {
    return res
      .status(500)
      .json(`Error happened: ${error.message} | ${error?.response?.data}`);
  }
}

const isValidAction = (value: any): value is Actions => {
  return Object.values(Actions).includes(value as Actions);
};

async function allOrders(req: NextApiRequest, res: NextApiResponse) {
  const apiResponse: ApiResponse = await libAllOrders(req.query);
  if (apiResponse.ok) {
    return res.status(apiResponse.code).json(apiResponse.response);
  } else {
    return res.status(apiResponse.code).json({ error: apiResponse.error });
  }
}

async function cancelOrder() {
  try {
    const symbol = "BTCUSDT"; // Trading pair
    const orderId = 12345678; // Replace with the actual orderId

    const response: CancelOrderResult = await client.cancelOrder({
      symbol,
      orderId,
    });
    console.log("Order canceled successfully:", response.status);
  } catch (error: any) {
    console.error(
      "Error canceling order:",
      error.response?.data || error.message
    );
  }
}

export async function libAllOrders({
  symbol = "",
  startTime = "0",
}): Promise<ApiResponse> {
  let resultCode: number = 500;
  let resultBody: string = "";

  if (!symbol || symbol === "" || typeof symbol !== "string") {
    //resultCode = 400;
    //resultBody = '{error: "Invalid symbol parameter"}';
    return {
      ok: false,
      code: 400,
      response: null,
      error: "Invalid symbol parameter",
    };
    //////return { resultCode, resultBody };
  }

  return binanceapiutil("allOrders", { symbol, startTime });
}

export default withAuth(handler);
