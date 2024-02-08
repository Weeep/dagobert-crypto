import React, { useState } from "react";
import TransactionIf from "../components/TransactionIf";
import TransactionCard from "../components/TransactionCard";

interface Props {
  transactions: TransactionIf[];
}

const TransactionCardContainer: React.FC<Props> = ({ transactions }) => {
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);

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

  return (
    <div className="container mx-auto p-8">
      <div className="flex flex-wrap gap-4">
        {uniqueSymbols.map((symbol: string) => (
          <label key={symbol} className="flex items-center">
            <input
              type="checkbox"
              checked={selectedSymbols.includes(symbol)}
              onChange={() => handleCheckboxChange(symbol)}
              className="form-checkbox h-5 w-5 text-indigo-600"
            />
            <span className="ml-2 text-gray-800">{symbol}</span>
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
            />
          ))}
      </div>
    </div>
  );
};

export default TransactionCardContainer;
