import React, { useState } from 'react';

interface TestItem {
    id: string
    symbol: string;
    price: string;
}

interface Props {
    data: TestItem[]
}

const FilteredList: React.FC<Props> = ({ data }) => {
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);

  const handleCheckboxChange = (symbol: string) => {
    if (selectedSymbols.includes(symbol)) {
      setSelectedSymbols(selectedSymbols.filter((s) => s !== symbol));
    } else {
      setSelectedSymbols([...selectedSymbols, symbol]);
    }
  };

  const filteredData = data.filter((item: TestItem) => {
    return selectedSymbols.length === 0 || selectedSymbols.includes(item.symbol);
  });

  const uniqueSymbols = Array.from(new Set(data.map((item) => item.symbol)));

  return (
    <div>
      <h2>Filtered List</h2>
      <div>
        {uniqueSymbols.map((symbol: string) => (
          <label key={symbol}>
            <input
              type="checkbox"
              checked={selectedSymbols.includes(symbol)}
              onChange={() => handleCheckboxChange(symbol)}
            />
            {symbol}
          </label>
        ))}
      </div>
      <ul>
        {filteredData.map((item: TestItem) => (
          <li key={item.id}>{`ID: ${item.id}, Symbol: ${item.symbol}, Price: ${item.price}`}</li>
        ))}
      </ul>
    </div>
  );
};

export default FilteredList;