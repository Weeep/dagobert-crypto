'use client'

import React, { useState, useEffect } from 'react';

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
    return (
        <>
            <hr />
            <p>{transaction.orderId}</p>
            <p>{transaction.updateTime}</p>
            <p>{transaction.side}</p>
            <hr />
        </>
    );
}

const TestPage: React.FC = () => {
  const [apiResponse, setApiResponse] = useState<Transaction[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/transactions');
        const data = await response.json();
        setApiResponse(data);
      } catch (error: any) {
        console.error('Error fetching data:', error.message);   // TODO
      }
    };

    fetchData();
  }, []); // Empty dependency array ensures the effect runs only once, similar to componentDidMount

  return (
    <div>
      <h1>API Response:</h1>
      {apiResponse.map(transaction => formatTransaction(transaction))}
    </div>
  );
};

export default TestPage;
