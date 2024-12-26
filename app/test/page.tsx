"use client";

import React, { useState, useEffect } from "react";

/*
"symbol": "SOLUSDT",
"orderId": 2805178958,
"executedQty": "0.62000000",
"cummulativeQuoteQty": "24.90540000",
"status": "FILLED",
"type": "LIMIT",
"side": "BUY",
"updateTime": 1654168978315,
*/
interface Transaction {
  symbol: string;
  orderId: number;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: string;
  type: string;
  side: string;
  updateTime: number;
}

function formatTransaction(transaction: Transaction) {
  console.log(transaction.symbol);
  return (
    <div key={transaction.orderId}>
      <hr />
      <p>{transaction.symbol}</p>
      <p>{transaction.orderId}</p>
      <p>{transaction.executedQty}</p>
      <p>
        {getAmount(transaction.cummulativeQuoteQty, transaction.executedQty)}
      </p>
      <p>{formatDate(transaction.updateTime)}</p>
      <p>{transaction.side}</p>
      <hr />
    </div>
  );
}

function getAmount(cummulativeQuoteQty: string, executedQty: string) {
  const numCqq = cummulativeQuoteQty as unknown as number;
  const numEq = executedQty as unknown as number;

  return numCqq / numEq;
}

function formatDate(epoch: number) {
  const date = new Date(epoch);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDay()}`;
  //return `${date.getFullYear()}-${date.getMonth()}-${date.getDay()} ${date.getHours()}:${date.getMinutes()}`
}

const TestPage: React.FC = () => {
  const coins = ["SOL", "MATIC", "ARB"]; //, 'DOT', 'AVAX', 'ETH', 'BTC'];

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [coin, setCoin] = useState<string>(coins.shift() as string);

  /*uuuseEffect(() => {
  //const fetchTransactions = async () => {
    console.log(`fetchTransactions ${coin} started`)
    try {
      const response = await fetch(`/api/transactions?symbol=${coin}USDT`);
      const data = await response.json();
      if(response.status !== 200) {
        throw response.status + '-' + JSON.stringify(data)
      }

      //let newApiResponse = apiResponse
      //newApiResponse.push(...data)
      //console.log(newApiResponse[0])
      //newApiResponse.sort((a, b) => b.updateTime - a.updateTime);
      //setApiResponse(newApiResponse); ..
      setTransactions((prev) => {prev.push(...data); return prev});
    } catch (error: any) {
      console.error('Error fetching data:', error?.message || error);   // TODO
    } finally {
      const nextCoin: string = coins.shift() as string;
      if(nextCoin !== undefined) {
        setCoin(nextCoin);
      }
    }
    return ''
  //}
  }, [coin]);*/

  console.log("aaaaaaaaaaaaaa");

  let firstUseEffect: boolean = true;
  useEffect(() => {
    if (firstUseEffect) {
      firstUseEffect = false;

      const fetchData = async (coin: string) => {
        try {
          const response = await fetch(`/api/transactions?symbol=${coin}USDT`);
          const data = await response.json();
          console.log(`### ${response.status} ###`);
          if (response.status !== 200) {
            throw response.status + "-" + JSON.stringify(data);
          }

          let newApiResponse = transactions;
          newApiResponse.push(...data);
          //console.log(newApiResponse[0])
          newApiResponse.sort((a, b) => b.updateTime - a.updateTime);
          //setApiResponse(newApiResponse); ..
          setTransactions((prev) => {
            prev.push(...data);
            return prev;
          });
        } catch (error: any) {
          console.error("Error fetching data:", error?.message || error); // TODO
        }
      };

      for (const c of coins) {
        fetchData(c);
      }
    }
  }, []); // Empty dependency array ensures the effect runs only once, similar to componentDidMount

  return (
    <div>
      <h1>API Response:</h1>
      <p>Fetch coin: {coin}</p>
      {transactions.map((transaction) => formatTransaction(transaction))}
    </div>
  );
};

//// {fetchTransactions()}</p>

export default TestPage;
