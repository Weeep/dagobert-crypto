"use client";

import { useState, useEffect } from "react";
import { TransactionIf, SymbolPriceIf } from "./components/Interfaces";
import TransactionCardContainer from "./components/TransactionCardContainer";

const TransactionViewer = () => {
  const [transactionData, setTransactionData] = useState<TransactionIf[]>([]);
  const [symbolPrices, setSymbolPrices] = useState<SymbolPriceIf[]>([]);

  const fetchTransactionData = async () => {
    try {
      const response = await fetch(`/api/transactions?status=FILLED`);
      const data = await response.json();
      if (response.status !== 200 || data?.code) {
        throw response.status + "-" + JSON.stringify(data);
      }

      (data as TransactionIf[]).sort((a, b) => b.updateTime - a.updateTime);
      setTransactionData(data);
    } catch (error) {
      console.error(`Error fetching data:`, error);
    }

    fetchPrices();
    const intervalId = setInterval(fetchPrices, 15000);
  };

  let useEffectFirst = true;
  useEffect(() => {
    if (useEffectFirst) {
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
    try {
      const response = await fetch(
        `/api/transactions?action=refreshDb&status=FILLED`
      );
      const data = await response.json();
      if (response.status !== 200 || data?.code) {
        throw response.status + "-" + JSON.stringify(data);
      }

      fetchTransactionData();
    } catch (error) {
      console.error(`Error fetching data:`, error);
    }
  };

  return (
    <div>
      <button
        className="m-10 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full focus:outline-none focus:shadow-outline-blue active:bg-blue-800"
        onClick={refreshDb}
      >
        Refresh
      </button>
      <TransactionCardContainer
        transactions={transactionData}
        symbolPrices={symbolPrices}
      />
    </div>
  );
  //<div>{currentSymbol && <p>{currentSymbol}</p>}</div>
};

export default TransactionViewer;
