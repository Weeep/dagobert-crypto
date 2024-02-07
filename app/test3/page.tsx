"use client";

import React, { useState, useEffect } from "react";
import TransactionIf from "../components/TransactionIf";
import TransactionCardContainer from "../components/TransactionCardContainer";

const TransactionViewer = () => {
  //const [currentSymbol, setCurrentSymbol] = useState<string>("");
  const [transactionData, setTransactionData] = useState<TransactionIf[]>([]);
  //let transactionsAggregated: TransactionIf[] = [];

  const fetchTransactionData = async (index: number) => {
    // if (index < symbols.length) {
    //  const symbol: string = symbols[index];
    try {
      //setCurrentSymbol(`Fetching transactions`); // ${symbol}`);
      const response = await fetch(`/api/transactions?status=FILLED`); //?symbol=${symbol}USDT`);
      const data = await response.json();
      if (response.status !== 200 || data?.code) {
        throw response.status + "-" + JSON.stringify(data);
      }

      //transactionsAggregated = [...transactionsAggregated, ...data];
      (data as TransactionIf[]).sort((a, b) => b.updateTime - a.updateTime);
      setTransactionData(data);
      //fetchTransactionData(index + 1);
    } catch (error) {
      console.error(`Error fetching data:`, error); // for ${symbol}:`
    }
    // } else {
    //  setCurrentSymbol(`All transactions fetched.`);
    //}
  };

  let useEffectFirst = true;
  useEffect(() => {
    if (useEffectFirst) {
      useEffectFirst = false;
      fetchTransactionData(0);
    }
  }, []);

  const refreshDb = async () => {
    try {
      const response = await fetch(
        `/api/transactions?action=refreshDb&status=FILLED`
      );
      const data = await response.json();
      if (response.status !== 200 || data?.code) {
        throw response.status + "-" + JSON.stringify(data);
      }

      fetchTransactionData(0);
    } catch (error) {
      console.error(`Error fetching data:`, error); // for ${symbol}:`
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
      <TransactionCardContainer transactions={transactionData} />
    </div>
  );
  //<div>{currentSymbol && <p>{currentSymbol}</p>}</div>
};

export default TransactionViewer;
