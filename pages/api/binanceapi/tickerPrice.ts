import type { NextApiRequest, NextApiResponse } from "next";
import { binanceClient } from "../../../utils/binanceapiutil";
import { withAuth } from "@/utils/auth";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.query.symbols && typeof req.query.symbols === "string") {
    return fetchSymbols(res, req.query.symbols);
  } else if (req.query.symbol && typeof req.query.symbol === "string") {
    return fetchSymbol(res, req.query.symbol);
  } else if (req.query.action) {
    if (req.query.action.toString().toLowerCase() === "futuresprices") {
      const r = await binanceClient.prices();
      return res.status(200).json(r);
    } else if (
      req.query.action.toString().toLowerCase() === "futuresdailystats"
    ) {
      const r = await binanceClient.dailyStats();
      return res.status(200).json(r);
    }
  } else {
    return fetchSymbol(res);
  }
}

async function fetchSymbols(res: NextApiResponse, symbols: string) {
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

async function fetchSymbol(res: NextApiResponse, symbol: string | null = null) {
  try {
    let p;
    if (symbol === null) {
      p = await binanceClient.prices();
    } else {
      p = await binanceClient.prices({ symbol });
    }

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
