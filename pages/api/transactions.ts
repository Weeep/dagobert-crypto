import { kv } from "@vercel/kv";
import type { NextApiRequest, NextApiResponse } from "next";
import { binanceapilib } from "../../pages/api/binanceapi";
import TransactionIf from "../../app/components/TransactionIf";

interface Transactions {
  transactions: TransactionIf[];
  responseCode: number;
  error: string | null;
}

const symbols: string[] = [
  "BTCUSDT",
  "ETHUSDT",
  "ADAUSDT",
  "DOTUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "SOLUSDT",
  "TRXUSDT",
  "AVAXUSDT",
  "MATICUSDT",
  "SHIBUSDT",
  "ICPUSDT",
  "ARBUSDT",
];

let allBinanceTransactions: TransactionIf[] = [];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { action, status } = req.query;
  //if (!symbol || typeof symbol !== "string") {
  //  return res.status(400).json({ error: "Invalid symbol parameter" });
  //}

  let statusStr = status && typeof status === "string" ? status : "";

  if (!action) {
    const transactions: Transactions = await getTransactionsFromDb(statusStr);
    res.status(transactions.responseCode).json(transactions.transactions);
  } else {
    if (action === "refreshDb") {
      for (const symbol of symbols) {
        await refreshDbFromBinance(symbol, statusStr, false);
      }

      console.log("all done");

      res
        .status(200)
        .json({ info: "Database refreshed, hope everything was OK. :)" });
    } else {
      res.status(400).json({ error: "Invalid source parameter" });
    }
  }
}

const refreshDbFromBinance = async (
  symbol: string,
  status: string,
  fromTimestamp: boolean = true
): Promise<Transactions> => {
  try {
    const { resultCode, resultBody } = await binanceapilib({
      symbol,
      startTime: fromTimestamp
        ? (await kv.get(
            `updated_time_of_last_processed_transaction_${symbol}`
          )) || "0"
        : "0",
    });

    let transactions = JSON.parse(resultBody) as TransactionIf[];
    if (
      transactions.length > 0 &&
      transactions[0]?.orderId &&
      transactions[0]?.updateTime
    ) {
      transactions.map(async (transaction) => {
        await kv.hset("transactions", { [transaction.orderId]: transaction });
      });
    }

    console.log(`${symbol} done.`);

    return {
      transactions: transactions,
      responseCode: 200,
      error: null,
    } as Transactions;
  } catch (e: any) {
    return {
      transactions: [] as TransactionIf[],
      responseCode: e.response?.status || 500,
      error: e.message,
    } as Transactions;
  }

  //return new Promise((resolve, reject) => {
  //  resolve([] as TransactionIf[]);
  //});
};

const getTransactionsFromDb = async (status: string): Promise<Transactions> => {
  const allTransactions = (await kv.hgetall("transactions")) || {};

  let filteredTransactions: TransactionIf[] = Object.values(
    allTransactions
  ) as TransactionIf[];

  if (status !== "")
    filteredTransactions = filteredTransactions.filter(
      (obj) => obj.status === status
    );

  //return new Promise((resolve, reject) => {
  //  resolve({
  return {
    transactions: filteredTransactions,
    responseCode: 200,
    error: null,
  } as Transactions;
  //  });
  //});
};

/*
async function handler2(req: NextApiRequest, res: NextApiResponse) {
  const { symbol, status } = req.query; //TODO addStartTime is bad
  if (!symbol || typeof symbol !== "string") {
    return res.status(400).json({ error: "Invalid symbol parameter" });
  }

  let startTime: string =
    (await kv.get(`updated_time_of_last_processed_transaction_${symbol}`)) ||
    "0";

  try {
    const { resultCode, resultBody } = await binanceapilib({
      symbol,
      startTime,
    });
    //await fetch(
    //  `/api/binanceapi?symbol=${symbol}&startTime=${startTime}`
    //);
    //const transactions = await binanceRes.json();
    console.log(resultBody);
    res.status(200).json(resultBody);
  } catch (e: any) {
    res.status(e.response?.status || 500).json(e.message);
  }

  /*
  let tryToFetch = true;
  let msCounter = 0;
  let resultCode = 0;
  let resultBody: any = "";
  while (tryToFetch && msCounter <= 8) {
    let binanceUrl = "https://api.binance.com/api/v3/allOrders";
    const params: Record<string, any> = {
      symbol,
      startTime,
      timestamp: Math.floor(Date.now() + 4000 - msCounter * 1000),
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
      console.log(transactions);

      tryToFetch = transactions?.code == -1021;

      if (
        Array.isArray(transactions) &&
        transactions.length > 0 &&
        transactions[0]?.updateTime
      ) {
        transactions.map(async (transaction) => {
          await kv.hset("transactions", { [transaction.orderId]: transaction });
        });

        transactions.sort((a, b) => b.updateTime - a.updateTime);
        if (startTime < transactions[0].updateTime) {
          await kv.set(
            "updated_time_of_last_processed_transaction",
            transactions[0].updateTime
          );
        }
        resultCode = 200;

        const allTransactions = (await kv.hgetall("transactions")) || {};
        resultBody = Object.values(allTransactions);
      } else {
        //TODO !!!!!
        resultCode = 200;
        resultBody = transactions;
      }
    } catch (e: any) {
      tryToFetch = false;
      resultCode = e.response?.status || 500;
      resultBody = e.message;
    }
  }

  res.status(resultCode).json(resultBody);
  * /
}
*/
