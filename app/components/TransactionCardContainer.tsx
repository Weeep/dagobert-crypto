import React, { useState } from "react";
import { TransactionIf, SymbolPriceIf } from "./Interfaces";
import TransactionCard from "../components/TransactionCard";

interface Props {
  transactions: TransactionIf[];
  symbolPrices: SymbolPriceIf[];
}

const convertArrayToObject = (
  array: SymbolPriceIf[]
): { [key: string]: number } => {
  return array.reduce((obj: { [key: string]: number }, item: SymbolPriceIf) => {
    obj[item.symbol] = parseFloat(item.price as unknown as string);
    return obj;
  }, {});
};

const TransactionCardContainer: React.FC<Props> = ({
  transactions,
  symbolPrices,
}) => {
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [markedForRemove, setMarkedForRemove] = useState<TransactionIf[]>([]);

  const handleTransactionMarked = (
    transaction: TransactionIf,
    add: boolean
  ) => {
    let newMarkedForRemove: TransactionIf[] = [];
    if (add) {
      newMarkedForRemove = [...markedForRemove, transaction];
    } else {
      newMarkedForRemove = markedForRemove.filter(function (item) {
        return item !== transaction;
      });
    }
    setMarkedForRemove(newMarkedForRemove);
  };

  const handleCheckboxChange = (symbol: string) => {
    if (selectedSymbols.includes(symbol)) {
      setSelectedSymbols(selectedSymbols.filter((s) => s !== symbol));
    } else {
      setSelectedSymbols([...selectedSymbols, symbol]);
    }
  };

  const uniqueSymbols = Array.from(
    new Set(transactions.map((t) => t.symbol))
  ).sort();
  const filteredData = transactions.filter((t: TransactionIf) => {
    return selectedSymbols.length === 0 || selectedSymbols.includes(t.symbol);
  });

  //console.log(symbolPrices);
  const symbolPricesObj = convertArrayToObject(symbolPrices);

  return (
    <div className="container mx-auto p-8">
      {markedForRemove.length > 1 ? (
        <>
          <button className="m-10 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full focus:outline-none focus:shadow-outline-blue active:bg-blue-800">
            Merge
          </button>
          <div>{JSON.stringify(markedForRemove)}</div>
        </>
      ) : (
        ""
      )}
      <div className="flex flex-wrap gap-4">
        {uniqueSymbols.map((symbol: string) => (
          <label key={symbol} className="flex items-center">
            <input
              type="checkbox"
              checked={selectedSymbols.includes(symbol)}
              onChange={() => handleCheckboxChange(symbol)}
              className="form-checkbox h-5 w-5 text-indigo-600"
            />
            <span className="ml-2">
              {symbol}
              <br />
              <small>${symbolPricesObj[symbol]}</small>
            </span>
          </label>
        ))}
      </div>
      <h1 className="text-2xl font-bold mb-4 mt-4">Transactions</h1>
      <div
        id="cont"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {filteredData.length !== 0 &&
          filteredData.map((transaction) => (
            <TransactionCard
              key={transaction.orderId}
              transaction={transaction}
              onClick={handleTransactionMarked}
            />
          ))}
      </div>
    </div>
  );
};

export default TransactionCardContainer;
