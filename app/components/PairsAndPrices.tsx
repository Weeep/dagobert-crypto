import { /*React, {*/ useState } from "react";
import { SymbolPriceIf } from "./Interfaces";
import Image from "next/image";

interface Props {
  pairsAndPrices: SymbolPriceIf[];
  selectedPairs: string[];
  setSelectedPairs: (selectedPairs: string[]) => void;
}

const PairsAndPrices: React.FC<Props> = ({
  pairsAndPrices,
  selectedPairs,
  setSelectedPairs,
}) => {
  //const [selectedPairs, setSelectedPairs] = useState<string[]>([]);

  const convertArrayToObject = (
    array: SymbolPriceIf[]
  ): { [key: string]: number } => {
    return array.reduce(
      (obj: { [key: string]: number }, item: SymbolPriceIf) => {
        obj[item.symbol] = parseFloat(item.price as unknown as string);
        return obj;
      },
      {}
    );
  };

  const symbolPricesObj = convertArrayToObject(pairsAndPrices);

  const handleCheckboxChange = (symbol: string) => {
    if (selectedPairs.includes(symbol)) {
      setSelectedPairs(selectedPairs.filter((s) => s !== symbol));
    } else {
      setSelectedPairs([...selectedPairs, symbol]);
    }
  };

  return (
    <>
      {/* p-8">*/}
      <h1 className="text-2xl font-bold mb-4 mt-4">Pairs</h1>
      <div className="flex flex-wrap gap-4">
        {Object.keys(symbolPricesObj).map((symbol: string) => (
          <label key={symbol} className="flex items-center">
            <input
              type="checkbox"
              checked={selectedPairs.includes(symbol)}
              onChange={() => handleCheckboxChange(symbol)}
              className="form-checkbox h-5 w-5 text-indigo-600"
            />
            <div className="ml-2">
              <div className="flex space-x-2">
                <div>{symbol}</div>
                <a
                  href={`https://www.tradingview.com/chart/hwbr0Mgr/?symbol=BINANCE%3A${symbol}`}
                  target="_blank"
                >
                  <Image
                    src="/images/white-short-logo.png"
                    alt="tradingview-logo"
                    width={24}
                    height={24}
                  />
                </a>
              </div>
              <small>${symbolPricesObj[symbol]}</small>
            </div>
          </label>
        ))}
      </div>
    </>
  );
};

export default PairsAndPrices;
