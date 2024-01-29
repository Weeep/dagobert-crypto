'use client'

import React, { useState, useEffect } from 'react';
import FilteredList from '../components/FilteredList';

const TestPage: React.FC = () => {
  /*const [coin, setCoin] = useState<string>('');
  const coins = ['SOL', 'MATIC']; //, 'DOT', 'AVAX', 'ETH', 'BTC'];
  let firstUseEffect: boolean = true

  useEffect(() => {
    if(firstUseEffect) {
      firstUseEffect = false
     
      for (const c of coins) {
        setCoin(c)
      }
    }
  }, []);

  const s = {
    backgroundColor: 'red',
    margin: '10px',
    padding: '10px',
  };*/

  const ttt = [
    {
      "id": "1",
      "symbol": "SOLUSDT",
      "price": "10"
    },
    {
      "id": "2",
      "symbol": "SOLUSDT",
      "price": "20"
    },
    {
      "id": "3",
      "symbol": "MATICUSDT",
      "price": "30"
    },
    {
      "id": "4",
      "symbol": "BTCUSDT",
      "price": "40"
    },
    {
      "id": "5",
      "symbol": "MATICUSDT",
      "price": "50"
    },
    {
      "id": "6",
      "symbol": "BTCUSDT",
      "price": "17"
    },
    {
      "id": "7",
      "symbol": "BTCUSDT",
      "price": "71"
    },
    {
      "id": "8",
      "symbol": "DOTUSDT",
      "price": "1"
    },
    {
      "id": "9",
      "symbol": "ADAUSDT",
      "price": "2"
    },
    {
      "id": "10",
      "symbol": "ADAUSDT",
      "price": "3"
    },
    {
      "id": "11",
      "symbol": "SOLUSDT",
      "price": "4"
    }
  ];

  return (
    <div>
      <FilteredList data={ttt} />
    </div>
  );
};

export default TestPage;


/*
import React, { useState, useEffect } from 'react';
import ProgressInfo from '../components/ProgressInfo';

const sleep = async (ms: number) => new Promise((r) => setTimeout(r, ms));
    
const TestPage: React.FC = () => {
  const [coin, setCoin] = useState<string>('');
  let coins = ['SOL', 'MATIC', 'DOT', 'AVAX', 'ETH', 'BTC'];

  for (const coin of ['SOL', 'MATIC']) {

  /*
  useEffect(() => {
    console.log('useEffect starts', coin, coins.length)
    //sleep(10000)
    setCoin(coins.shift() as string)
    console.log(coin)
    //const intervalId = setInterval(() => {
    //  setIndex((prevIndex) => (prevIndex + 1) % coins.length);
    //}, 1000);

    //return () => clearInterval(intervalId); // Cleanup interval on component unmount
  }, [coin]); // Add coins.length as a dependency to useEffect
  */

  /*
  const s = {
    backgroundColor: 'red',
    margin: '10px',
    padding: '10px',
  };
  * /

  return (
    <>
      <ProgressInfo info={`Current Coin: ${coin}`} />
      {/* Button is not needed in this version * /}
    </>
  );
};

export default TestPage;
*/
