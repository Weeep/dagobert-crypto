import type { NextApiRequest, NextApiResponse } from "next";
import { binanceClient } from "../../../utils/binanceapiutil";
import { withAuth } from "@/utils/auth";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.query.symbols && typeof req.query.symbols === "string") {
    return fetchSymbols(req.query.symbols, res);
  } else if (req.query.symbol && typeof req.query.symbol === "string") {
    return fetchSymbol(req.query.symbol, res);
  } else {
    return res
      .status(400)
      .json(
        'symbols (e.g.: ["SOLUSDC","AVAXUSDT"]) or symbol (SOLUSDC) mandatory'
      );
  }
}

async function fetchSymbols(symbols: string, res: NextApiResponse) {
  try {
    const symbolsArr = JSON.parse(symbols);
    const pricesObj = await binanceClient.prices();
    const filteredPricesObj = Object.fromEntries(
      Object.entries(pricesObj).filter(([key]) => symbolsArr.includes(key))
    );

    const pricesArr = Object.entries(filteredPricesObj).map((item) => {
      return { symbol: item[0], price: item[1] };
    });

    //const pricesArr: { symbol: string; price: string }[] = [];
    //for (const p of filteredPrices) {
    //  const p = await binanceClient.prices({ symbol });
    //  pricesArr.push({ symbol: Object.keys(p)[0], price: Object.values(p)[0] });
    //}

    return res.status(200).json(pricesArr);
  } catch (error: any) {
    return res.status(500).json({ message: error.message, error });
  }
}

async function fetchSymbol(symbol: string, res: NextApiResponse) {
  try {
    const p = await binanceClient.prices({ symbol });
    return res.status(200).json(p);

    // const symbolsArr = JSON.parse(symbols);
    // const pricesObj = await binanceClient.prices();
    // const filteredPricesObj = Object.fromEntries(
    //   Object.entries(pricesObj).filter(([key]) => symbolsArr.includes(key))
    // );

    // const pricesArr = Object.entries(filteredPricesObj).map((item) => {
    //   return { symbol: item[0], price: item[1] };
    // });

    // //const pricesArr: { symbol: string; price: string }[] = [];
    // //for (const p of filteredPrices) {
    // //  const p = await binanceClient.prices({ symbol });
    // //  pricesArr.push({ symbol: Object.keys(p)[0], price: Object.values(p)[0] });
    // //}

    // return res.status(200).json(pricesArr);
  } catch (error: any) {
    return res.status(500).json({ message: error.message, error });
  }
}

export default withAuth(handler);
