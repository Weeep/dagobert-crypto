import { /*React, {*/ useEffect, useState } from "react";
import { SymbolPriceIf } from "../lib/Interfaces";
import Image from "next/image";
import { convertArrayToObject, redCross } from "@/utils/helper";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { DagobertTransaction, KVRoot } from "@/utils/typesAndEnums";
import Dtransactions from "../lib/Dtransactions";
import ClientSideDbCache from "../lib/ClientSideDbCache";
import { faRefresh } from "@fortawesome/free-solid-svg-icons";

interface Props {
  pairsPricesCallback: (pairsPrices: {
    [key: string]: {
      price: number;
      numOfTransactions: number;
    };
  }) => void;

  selectedPairs: string[];
  selectedPairsCallback: (selectedPairs: string[]) => void;
}

const PairsAndPrices: React.FC<Props> = ({
  pairsPricesCallback,
  selectedPairs,
  selectedPairsCallback,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [pairInfo, setPairInfo] = useState<string>("");
  const [pairsPrices, setPairsPrices] = useState<{
    [key: string]: {
      price: number;
      numOfTransactions: number;
    };
  }>({});

  //const pairPrices = convertArrayToObject(pairsAndPrices);

  useEffect(() => {
    fetchPrices();
    //const intervalId = setInterval(fetchPrices, 15000);
    //}
  }, []);

  const fetchPrices = async (): Promise<boolean> => {
    setIsFetching(true);
    try {
      const pairs = ClientSideDbCache.smembers(KVRoot.pairs); //await fetchh(`/api/dbapi/pairs`);
      if (!pairs) {
        setPairInfo("No any pair defined. Go to Config and add some.");
        return false;
      }
      //if (pairsResponse.ok) {
      //const pairs = await pairsResponse.json();

      if ((pairs as string[]).length === 0) return false;

      const response = await fetch(
        `/api/binanceapi/tickerPrice?symbols=${JSON.stringify(pairs)}`
        // ["ADAUSDT","ARBUSDT","AVAXUSDT","BNBUSDT","BTCUSDT","DOTUSDT","ETHUSDT","ICPUSDT","MATICUSDT","SHIBUSDT","SOLUSDT","TRXUSDT","XRPUSDT"]
      );

      const prices = await response.json();
      if (response.status !== 200 || prices?.code) {
        throw response.status + "-" + JSON.stringify(prices);
      }

      /// Num of Trans calculation
      let numOfTransactions: { [key: string]: number } = {};
      const dtranss: DagobertTransaction[] = Object.values(
        Dtransactions.getAll()
      );

      for (const dtrans of dtranss) {
        if (!dtrans.grouped) {
          if (!(dtrans.pair in numOfTransactions)) {
            numOfTransactions[dtrans.pair] = 1;
          } else {
            numOfTransactions[dtrans.pair] += 1;
          }
        }
      }

      for (const price of prices as SymbolPriceIf[]) {
        price.numOfTransactions =
          price.symbol in numOfTransactions
            ? numOfTransactions[price.symbol]
            : 0;
      }
      ///

      const ppobj = convertArrayToObject(prices as SymbolPriceIf[]);

      setPairsPrices(ppobj);
      pairsPricesCallback(ppobj);
    } catch (error) {
      setPairInfo(
        `${redCross} Error fetching prices: ${JSON.stringify(error)}`
      );
      console.error(`Error fetching prices:`, error);
      return false;
    } finally {
      setIsFetching(false);
    }

    //setInterval(fetchPrices, 15000);
    return true;
  };

  const handleCheckboxChange = (symbol: string) => {
    if (selectedPairs.includes(symbol)) {
      selectedPairsCallback(selectedPairs.filter((s) => s !== symbol));
    } else {
      selectedPairsCallback([...selectedPairs, symbol]);
    }
  };

  const updatePairsAndPrices = () => {};

  return (
    <>
      <div className="flex flex-row gap-2 items-center text-2xl font-bold mb-4 mt-4">
        <h1 onClick={() => setIsOpen(!isOpen)}>
          <FontAwesomeIcon
            icon={faChevronRight}
            className={`transform transition-transform duration-300 ${
              isOpen ? "rotate-90" : "rotate-0"
            }`}
          />{" "}
          Pairs
          {/*<FontAwesomeIcon icon={faRefresh} onClick={updatePairsAndPrices()} />*/}
        </h1>
        <FontAwesomeIcon
          icon={faRefresh}
          onClick={fetchPrices}
          className={`cursor-pointer ${
            isFetching ? "animate-spin text-blue-500" : ""
          }`}
        />
      </div>
      {pairInfo && <div>{pairInfo}</div>}
      <div className={`${!isOpen ? "hidden" : ""} flex flex-wrap gap-4`}>
        {Object.keys(pairsPrices)
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
                  <div className="text-xs">${pairsPrices[symbol].price}</div>
                  <div className="text-xs">
                    {pairsPrices[symbol].numOfTransactions}
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
