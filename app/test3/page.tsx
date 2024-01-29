'use client'

import React, { useState, useEffect } from 'react';
import TransactionIf from '../components/TransactionIf';
import TransactionCardContainer from '../components/TransactionCardContainer';

const TransactionViewer = () => {
  const symbols: string[] = [
    'BTC', 'ETH', 'ADA', 'DOT', 
    'BNB', 'XRP', 'SOL', 'TRX', 
    'AVAX', 'MATIC', 'SHIB', 'ICP', 'ARB'];
  const [currentSymbol, setCurrentSymbol] = useState<string>('');
  const [transactionData, setTransactionData] = useState<TransactionIf[]>([]);
  let transactionsAggregated: TransactionIf[] = []

  const fetchTransactionData = async (index: number) => {
    if(index < symbols.length) {
      const symbol: string = symbols[index];
      try {
        setCurrentSymbol(`Fetching ${symbol}`);
        const response = await fetch(`/api/transactions?symbol=${symbol}USDT`);
        const data: TransactionIf[] = await response.json();
        if(response.status !== 200) {
          throw response.status + '-' + JSON.stringify(data)
        }

        const transactions: TransactionIf[] = data.filter(obj => obj.status === 'FILLED');

        transactionsAggregated = [...transactionsAggregated, ...transactions]
        transactionsAggregated.sort((a, b) => b.updateTime - a.updateTime);
        setTransactionData(transactionsAggregated)
        fetchTransactionData(index+1);
      } catch (error) {
        console.error(`Error fetching data for ${symbol}:`, error);
      }
    } else {
      setCurrentSymbol(`All transactions fetched.`);
    }
  };

  let useEffectFirst = true
  useEffect(() => {
    if(useEffectFirst) {
      useEffectFirst = false;
      fetchTransactionData(0);
    }
  }, []);

  return (
    <div>
      <div>
        {currentSymbol && <p>{currentSymbol}</p>}
      </div>
      <TransactionCardContainer transactions={transactionData} />
    </div>
  );
};

export default TransactionViewer;
