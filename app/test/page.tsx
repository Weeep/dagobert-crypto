import React from "react";

interface Transaction {
    orderId: number;
}

const Test = async () => {
    let binanceUrl = 'https://api.binance.com/api/v3/allOrders';
    
    const apiKey: string = 'wHI8QhwsZIbSESD9bVmkk8GYD7Vx8Kq6Jw5b1R5mAHkuV8NqnC64peSgCVCNOAcJ';
    const apiSecret: string = 'KMBJ6Hxw5Tjuf7h3u8BehdeFeRlLBgaffcZm79VLGWz6XETSmGpA8obhuXnmCKr6';
    
    const params: Record<string, any> = {
        'symbol': 'SOLUSDT',
        'timestamp': Math.floor(Date.now())
    }

    const query = new URLSearchParams(params).toString();
    
    //const sign = this.getSignature(query, this.apiSecret || '');
    const sign = require('crypto').createHmac('sha256', apiSecret).update(query).digest('hex');
    
    binanceUrl += `?${query}&signature=${sign}`;

    const header: RequestInit = {
        'headers': {
            'Content-Type': 'application/json',
            'X-MBX-APIKEY': apiKey 
        }
    };

    console.log(binanceUrl);
    
    try {
        const res = await fetch(binanceUrl, header)
        const transactions: Transaction[] = await res.json()

        console.log(JSON.stringify(transactions));

        return (
            <>
                <h1>Transactions</h1>
                <ul>
                    {transactions.map(transaction => <li>{transaction.orderId}</li>)}
                </ul>
            </>
        );
    } catch (error: any) {
        console.error(`Download error: ${error.message}`);
        return (
            <>
                <p>{error.message}</p>
            </>
        )
    }
}



export default Test

/*
// app/test/page.tsx

import React, { useState, useEffect } from "react";
import dynamic from 'next/dynamic';
//import TestComponent from "../../components/TextComponent";

const DynamicTestComponent = dynamic(
  () => import('../../components/TestComponent.tsx'),
  { ssr: false } // Mark the component to be excluded from server-side rendering
);

export default function Test() {
  const [result, setResult] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      // Your data fetching logic here

      try {
        // Simulate a call to BinanceAPI
        const apiResult = { example: 'data' };
        setResult(apiResult);
      } catch (error) {
        console.error('Error fetching data:', error.message);
      }
    };

    fetchData();
  }, []); // Empty dependency array ensures the effect runs only once, similar to componentDidMount

  return (
    <div>
      <DynamicTestComponent result={result} />
    </div>
  );
}
*/