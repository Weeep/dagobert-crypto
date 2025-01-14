import { /*React, {*/ useState } from "react";
import { SymbolPriceIf } from "../lib/Interfaces";
import Image from "next/image";
import {
  convertArrayToObject,
  downPointingTriangle,
  rightPointingTriangle,
} from "@/utils/helper";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";

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
  const [isOpen, setIsOpen] = useState<boolean>(false);

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
      <h1
        className="text-2xl font-bold mb-4 mt-4"
        onClick={() => setIsOpen(!isOpen)}
      >
        <FontAwesomeIcon
          icon={faChevronRight}
          className={`transform transition-transform duration-300 ${
            isOpen ? "rotate-90" : "rotate-0"
          }`}
        />{" "}
        Pairs
      </h1>
      <div className={`${!isOpen ? "hidden" : ""} flex flex-wrap gap-4`}>
        {Object.keys(symbolPricesObj)
          .sort((a, b) => (a > b ? 1 : -1))
          .map((symbol: string) => (
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
                <div className="flex justify-between">
                  <div className="text-xs">
                    ${symbolPricesObj[symbol].price}
                  </div>
                  <div className="text-xs">
                    {symbolPricesObj[symbol].numOfTransactions}
                  </div>
                </div>
              </div>
            </label>
          ))}
      </div>
    </>
  );
};

export default PairsAndPrices;
