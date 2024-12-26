"use client";

import { useState, useEffect } from "react";
import { TransactionIf, SymbolPriceIf } from "./components/Interfaces";
import TransactionCardContainer from "./components/TransactionCardContainer";
import ProgressInfo from "./components/ProgressInfo";

const TransactionViewer = () => {
  const [transactionData, setTransactionData] = useState<TransactionIf[]>([]);
  const [symbolPrices, setSymbolPrices] = useState<SymbolPriceIf[]>([]);
  const [progressInfo, setProgressInfo] = useState<string>("");

  const fetchTransactionData = async () => {
    try {
      console.log("radadadadadaaaa");
      const response = await fetch(`/api/transactions?status=FILLED`);
      const data = await response.json();
      if (response.status !== 200 || data?.code) {
        throw response.status + "-" + JSON.stringify(data);
      } else {
        console.log(`sasasa ${data.length} sasasasa`);
        if (data.length === 0) {
          setProgressInfo(
            "No transaction in the database, fetch them by pressing Refresh (via binance api)."
          );
        }
        (data as TransactionIf[]).sort((a, b) => b.updateTime - a.updateTime);
        setTransactionData(data);
      }
    } catch (error) {
      console.error(`Error fetching data:`, error);
    }

    fetchPrices();
    const intervalId = setInterval(fetchPrices, 15000);
  };

  let useEffectFirst = true;
  useEffect(() => {
    if (useEffectFirst) {
      console.log("debug bbbbb");
      useEffectFirst = false;
      fetchTransactionData();
    }
  }, []);

  const fetchPrices = async () => {
    try {
      const response = await fetch(
        `/api/binanceapi/tickerPrice?symbols=["ADAUSDT","ARBUSDT","AVAXUSDT","BNBUSDT","BTCUSDT","DOTUSDT","ETHUSDT","ICPUSDT","MATICUSDT","SHIBUSDT","SOLUSDT","TRXUSDT","XRPUSDT"]`
      );

      const prices = await response.json();
      if (response.status !== 200 || prices?.code) {
        throw response.status + "-" + JSON.stringify(prices);
      }

      //(data2 as SymbolPriceIf[]).sort((a, b) => b.updateTime - a.updateTime);
      setSymbolPrices(JSON.parse(prices) as SymbolPriceIf[]);
    } catch (error) {
      console.error(`Error fetching data:`, error);
    }
  };

  const refreshDb = async () => {
    const symbols = ["DOTUSDT", "SOLUSDT"];

    for (const symbol of symbols) {
      try {
        const binanceResponse = await fetch(
          `/api/binanceapi/allOrders?symbol=${symbol}`
        );
        const data = await binanceResponse.json();
        if (binanceResponse.status !== 200 || data?.code) {
          throw binanceResponse.status + "-" + JSON.stringify(data);
        }

        setProgressInfo(JSON.stringify(data));

        try {
          const dbResponse = await fetch("/api/dbapi", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data }),
          });

          if (!dbResponse.ok) {
            throw dbResponse.status;
          } else {
            console.log("goooooddddd");
          }
        } catch (error) {
          console.error(`Error storing data in DB, symbol: ${symbol}`, error);
        }
      } catch (error) {
        console.error(
          `Error fetching data from Binance, symbol: ${symbol}`,
          error
        );
      }
    }

    fetchTransactionData();

    // try {
    //   const response = await fetch(
    //     `/api/transactions?action=refreshDb&status=FILLED`
    //   );
    //   const data = await response.json();
    //   if (response.status !== 200 || data?.code) {
    //     throw response.status + "-" + JSON.stringify(data);
    //   }

    //   fetchTransactionData();
    // } catch (error) {
    //   console.error(`Error fetching data:`, error);
    // }
  };

  return (
    <div>
      <button
        className="m-10 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full focus:outline-none focus:shadow-outline-blue active:bg-blue-800"
        onClick={refreshDb}
      >
        Refresh
      </button>
      <ProgressInfo info={progressInfo} />
      <TransactionCardContainer
        transactions={transactionData}
        symbolPrices={symbolPrices}
      />
    </div>
  );
  //<div>{currentSymbol && <p>{currentSymbol}</p>}</div>
};

export default TransactionViewer;
