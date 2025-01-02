import { ukv as kv } from "../../utils/dbapiutil";
import type { NextApiRequest, NextApiResponse } from "next";
import { libAllOrders } from "./binanceapi/allOrders";
import { TransactionIf } from "../../app/components/Interfaces";
import { ApiResponse, TransactionsApiResponse } from "@/utils/types";

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
  "SOLUSDC",
];

let allBinanceTransactions: TransactionIf[] = [];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { status } = req.query;
  //if (!symbol || typeof symbol !== "string") {
  //  return res.status(400).json({ error: "Invalid symbol parameter" });
  //}

  let statusStr = status && typeof status === "string" ? status : "";

  //if (!action) {
  const transactions: TransactionsApiResponse = await getTransactionsFromDb(
    statusStr
  );
  if (transactions.apiResponse.ok) {
    res.status(transactions.apiResponse.code).json(transactions.transactions); //why JSON.stringify not needed?
  } else {
    console.log(transactions.apiResponse.error + " sssssssss");
    res
      .status(transactions.apiResponse.code)
      .json({ error: transactions.apiResponse.error });
  }
  // } else {
  //   if (action === "refreshDb") {
  //     for (const symbol of symbols) {
  //       await refreshSymbolOrdersInDbFromBinance(symbol, statusStr, false);
  //     }

  //     console.log("all done");

  //     res
  //       .status(200)
  //       .json({ info: "Database refreshed, hope everything was OK. :)" });
  //   } else {
  //     res.status(400).json({ error: "Invalid source parameter" });
  //   }
  // }
}

//TODO not used probably or should not be used
const refreshSymbolOrdersInDbFromBinance = async (
  symbol: string,
  status: string,
  fromTimestamp: boolean = true
): Promise<TransactionsApiResponse> => {
  let apiResponse: ApiResponse;
  try {
    let startTime: string = "0";
    if (fromTimestamp) {
      apiResponse = await kv.get(
        `updated_time_of_last_processed_transaction_${symbol}`
      );
      if (!apiResponse.ok) {
        return {
          transactions: null,
          apiResponse,
        };
      }
      startTime = apiResponse.response === null ? "0" : apiResponse.response;
    }

    apiResponse = await libAllOrders({
      symbol,
      startTime,
    });

    if (!apiResponse.ok) {
      return {
        transactions: null,
        apiResponse,
      };
    }

    let transactions = JSON.parse(apiResponse.response) as TransactionIf[];
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
      apiResponse,
    } as TransactionsApiResponse;
  } catch (e: any) {
    return {
      transactions: null,
      apiResponse: {
        ok: false,
        response: null,
        code: e.response?.status || 500,
        error: e.message,
      } as ApiResponse,
    } as TransactionsApiResponse;
  }

  //return new Promise((resolve, reject) => {
  //  resolve([] as TransactionIf[]);
  //});
};

const getTransactionsFromDb = async (
  status: string
): Promise<TransactionsApiResponse> => {
  //const allTransactions = (await kv.hgetall("transactions")) || {};
  const dbResponse: ApiResponse = await kv.hgetall("transactions");
  if (!dbResponse.ok) {
    return {
      transactions: null,
      apiResponse: dbResponse,
    };
  }

  const allTransactions = dbResponse.response ? dbResponse.response : {};

  console.log(`DEBUG eee ${allTransactions} eee`);

  let filteredTransactions: TransactionIf[] = Object.values(
    allTransactions
  ) as TransactionIf[];

  if (status !== "")
    filteredTransactions = filteredTransactions.filter(
      (obj) => obj.status === status
    );

  //console.log("DEBUG fff " + JSON.stringify(filteredTransactions) + " fff");

  //return new Promise((resolve, reject) => {
  //  resolve({
  return {
    transactions: filteredTransactions,
    apiResponse: dbResponse,
  } as TransactionsApiResponse;
  //  });
  //});
};
