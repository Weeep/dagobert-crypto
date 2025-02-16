import { ReactElement, useEffect, useState } from "react";
import { PairPriceIf } from "../lib/Interfaces";
import Image from "next/image";
import {
  convertArrayToObject as arrayToObject,
  redCross,
} from "@/utils/helper";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { DagobertTransaction, KVRoot } from "@/utils/typesAndEnums";
import Dtransactions from "../lib/Dtransactions";
import ClientSideDbCache from "../lib/ClientSideDbCache";
import { faRefresh } from "@fortawesome/free-solid-svg-icons";
import CandlestickChart from "./CandlestickChart";
import { CandleChartResult } from "binance-api-node";
import { DCandle, TradingAnalysis } from "../lib/TradingAnalysis";
import Foldable from "./Foldable";

interface Props {
  pairsAndPricesCallback: (pairsPrices: { [key: string]: PairPriceIf }) => void;
  selectedPairsCallback: (selectedPairs: string[]) => void;
}

const PairsAndPrices: React.FC<Props> = ({
  pairsAndPricesCallback: pairsPricesCallback,
  selectedPairsCallback,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [pairInfo, setPairInfo] = useState<string>("");
  const [pairsPrices, setPairsPrices] = useState<{
    [key: string]: PairPriceIf;
  }>({});
  const [selectedPairs, setSelectedPairs] = useState<string[]>([]);
  // const [pairData1h, setPairData1h] = useState<PairData>({});
  // const [pairData1d, setPairData1d] = useState<PairData>({});
  const [emaRsis1h, setEmaRsis1h] = useState<{
    [key: string]: { ema100: number; rsi6: number };
  }>({});
  const [emaRsis1hColor, setEmaRsis1hColor] = useState<{
    [key: string]: {
      ema100: string; //"text-red-500" | "text-lime-500" | "text-gray-700";
      rsi6: string; //"text-red-500" | "text-lime-500" | "text-gray-700";
    };
  }>({});
  const [emaRsis1d, setEmaRsis1d] = useState<{
    [key: string]: { ema100: number; rsi6: number };
  }>({});
  const [emaRsis1dColor, setEmaRsis1dColor] = useState<{
    [key: string]: {
      ema100: string; //"text-red-500" | "text-lime-500" | "text-gray-700";
      rsi6: string; //"text-red-500" | "text-lime-500" | "text-gray-700";
    };
  }>({});
  //const [ema100s, setEma100s] = useState<{ [key: string]: number }>({});

  //const pairPrices = convertArrayToObject(pairsAndPrices);

  useEffect(() => {
    fetchAll();
    //const intervalId = setInterval(fetchPrices, 15000);
    //}
  }, []);

  const fetchAll = async () => {
    setIsFetching(true);
    setEmaRsis1hColor({});
    setEmaRsis1dColor({});
    try {
      const pp = await fetchPrices();
      if (pp !== null) {
        setPairsPrices(pp);
        pairsPricesCallback(pp);
        for (const pair of Object.keys(pp)) {
          fetchEmaRsi("1h", pair, pp[pair].price);
          fetchEmaRsi("1d", pair, pp[pair].price);
          //console.log(pair);
        }
        // for (const pair of ClientSideDbCache.smembers(
        //   KVRoot.pairs
        // ) as string[]) {
        //   fetchCandleData(pair, "1h", pp);
        //   //fetchCandleData(pair, "1d", pp);
        // }
      }
    } catch (error) {
      setPairInfo(
        `${redCross} Error fetching prices: ${JSON.stringify(error)}`
      );
      console.error(`Error fetching prices:`, error);
      return false;
    } finally {
      setIsFetching(false);
    }
  };

  const fetchEmaRsi = async (interval: string, pair: string, price: number) => {
    const response = await fetch(
      `/api/binanceapi/klines?symbol=${pair}&interval=${interval}&limit=111`
    );

    const data: DCandle[] = (await response.json()) as DCandle[];
    if (response.status !== 200 || !Array.isArray(data)) {
      console.error("error: " + response.status + " | " + JSON.stringify(data)); //TODO
      //price.rsi6 = -1; //TODO ??
      //price.ema100DiffPct = -200; //TODO ??
    } else {
      const ta = new TradingAnalysis(data, price);
      const pairEmaRsi = {
        rsi6: ta.getRsi(6) ?? -1,
        ema100: ta.getEma(100).emaDiffPct ?? -202,
      };
      const pairEmaRsiColor = {
        rsi6: getRsiColor(ta.getRsi(6) ?? 0),
        ema100: getEmaColor(ta.getEma(100).emaDiffPct ?? 0),
      };
      switch (interval) {
        case "1h":
          setEmaRsis1h((prev) => ({
            ...prev,
            [pair]: pairEmaRsi,
          }));
          setEmaRsis1hColor((prev) => ({
            ...prev,
            [pair]: pairEmaRsiColor,
          }));
          break;
        case "1d":
          setEmaRsis1d((prev) => ({
            ...prev,
            [pair]: pairEmaRsi,
          }));
          setEmaRsis1dColor((prev) => ({
            ...prev,
            [pair]: pairEmaRsiColor,
          }));
          break;
      }
    }
  };

  const fetchPrices = async (): Promise<{
    [key: string]: PairPriceIf;
  } | null> => {
    const pairs = ClientSideDbCache.smembers(KVRoot.pairs); //await fetchh(`/api/dbapi/pairs`);
    if (!pairs) {
      setPairInfo("No any pair defined. Go to Config and add some.");
      return null;
    }
    //if (pairsResponse.ok) {
    //const pairs = await pairsResponse.json();

    if ((pairs as string[]).length === 0) return null;

    const response = await fetch(
      `/api/binanceapi/tickerPrice?symbols=${JSON.stringify(pairs)}`
      // ["ADAUSDT","ARBUSDT","AVAXUSDT","BNBUSDT","BTCUSDT","DOTUSDT","ETHUSDT","ICPUSDT","MATICUSDT","SHIBUSDT","SOLUSDT","TRXUSDT","XRPUSDT"]
    );

    const rjson = await response.json();
    if (response.status !== 200 || !Array.isArray(rjson)) {
      throw response.status + "-" + JSON.stringify(rjson);
    }

    const prices = rjson.map(
      (price: { symbol: string; price: string }): PairPriceIf => {
        const pp: PairPriceIf = {
          pair: price.symbol,
          price: parseFloat(price.price),
          numOfTransactions: 0,
          rsi6: -1,
          ema100DiffPct: -200,
        };
        return pp;
      }
    );

    /// Num of Trans calculation
    let numOfTransactions: { [key: string]: number } = {};
    const dtranss: DagobertTransaction[] = Dtransactions.getAllFilled();

    for (const dtrans of dtranss) {
      if (!dtrans.grouped) {
        if (!(dtrans.pair in numOfTransactions)) {
          numOfTransactions[dtrans.pair] = 1;
        } else {
          numOfTransactions[dtrans.pair] += 1;
        }
      }
    }

    for (const price of prices as PairPriceIf[]) {
      price.numOfTransactions =
        price.pair in numOfTransactions ? numOfTransactions[price.pair] : 0;
    }
    ///

    return arrayToObject(prices as PairPriceIf[], "pair");
  };

  const handleCheckboxChange = (pair: string, event: React.ChangeEvent) => {
    event.stopPropagation();
    if (selectedPairs.includes(pair)) {
      selectedPairsCallback(selectedPairs.filter((s) => s !== pair));
      setSelectedPairs((prev) => prev.filter((s) => s !== pair));
    } else {
      selectedPairsCallback([...selectedPairs, pair]);
      setSelectedPairs((prev) => [...prev, pair]);
    }
  };

  const updatePairsAndPrices = () => {};

  const fetchCandleData = async (
    pair: string,
    interval: string,
    pp: {
      [key: string]: {
        price: number;
        numOfTransactions: number;
      };
    }
  ): Promise<void> => {
    const response = await fetch(
      `/api/binanceapi/klines?symbol=${pair}&interval=${interval}&limit=111`
    );

    const data: DCandle[] = (await response.json()) as DCandle[];
    if (response.status !== 200 || !Array.isArray(data)) {
      console.error("error: " + response.status + " | " + JSON.stringify(data)); //TODO
    } else {
      //const ta = new TradingAnalysis(data, pp[pair].price);
      //setRsi6(ta.getRsi(6)?.toFixed(0) ?? -1);
      //setEma100(ta.getEma(100).emaDiffPct ?? -1);
      // switch (interval) {
      //   case "1h":
      //     setPairData1h((prev) => {
      //       prev[pair] = {
      //         ema7: ta.getEma(7) ?? -1,
      //         ema25: ta.getEma(25) ?? -1,
      //         ema100: ta.getEma(100) ?? -1,
      //         rsi: ta.getRsi(6) ?? -1,
      //         diffToEma100: ta.getEmaDiffPct(pp[pair].price, 100) ?? -1000,
      //         candles: data,
      //       };
      //       return prev;
      //     });
      //     break;
      //   case "1d":
      //     setPairData1d((prev) => {
      //       prev[pair] = {
      //         ema7: ta.getEma(7) ?? -1,
      //         ema25: ta.getEma(25) ?? -1,
      //         ema100: ta.getEma(100) ?? -1,
      //         rsi: ta.getRsi(6) ?? -1,
      //         diffToEma100: ta.getEmaDiffPct(pp[pair].price, 100) ?? -1000,
      //         candles: data,
      //       };
      //       return prev;
      //     });
      //     break;
      // }
    }
  };

  const getRsiColor = (rsi: number): string => {
    if (rsi > 80) return "text-red-500";
    if (rsi < 20) return "text-lime-500";
    return "";
  };

  const getEmaColor = (ema: number): string => {
    if (ema < 0) return "text-red-500";
    else return "text-lime-500";
  };

  function emaRsiElement(
    pair: string,
    interval: string,
    emaRsiData: {
      [key: string]: { ema100: number; rsi6: number };
    },
    emaRsiDataColor: {
      [key: string]: { ema100: string; rsi6: string };
    }
  ): ReactElement {
    const rsiColor = emaRsiDataColor[pair]?.rsi6 ?? "text-gray-700";
    const rsi = emaRsiData[pair]?.rsi6.toFixed(2) ?? "...";
    const emaColor = emaRsiDataColor[pair]?.ema100 ?? "text-gray-700";
    const ema = emaRsiData[pair]?.ema100.toFixed(2) ?? "...";

    return (
      <div className="text-xs flex space-x-1">
        <span>
          {interval} RSI(6): <span className={rsiColor}>{rsi}</span>
        </span>
        <span>
          Ema100: <span className={emaColor}>{ema}</span>
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="cursor-pointer flex flex-row gap-2 items-center text-2xl font-bold mb-4 mt-4">
        <h1 onClick={() => setIsOpen(!isOpen)}>
          <FontAwesomeIcon
            icon={faChevronRight}
            className={`transform transition-transform duration-300 ${
              isOpen ? "rotate-90" : "rotate-0"
            }`}
          />{" "}
          Pairs
        </h1>
        <FontAwesomeIcon
          icon={faRefresh}
          onClick={fetchAll}
          className={`cursor-pointer ${
            isFetching ? "animate-spin text-blue-500" : ""
          }`}
        />
      </div>
      {pairInfo && <div>{pairInfo}</div>}
      <div className={`${!isOpen ? "hidden" : ""} flex flex-wrap gap-4`}>
        {Object.keys(pairsPrices)
          .sort((a, b) => (a > b ? 1 : -1))
          .map((pair: string) => (
            <div key={pair} className="w-52">
              <label
                //key={pair}
                className="p-1 flex items-center"
                onClick={(event) => event.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={selectedPairs.includes(pair)}
                  onChange={(event) => handleCheckboxChange(pair, event)}
                  className="form-checkbox h-5 w-5 mr-1 text-indigo-600"
                />
                {pair} ${pairsPrices[pair].price}
              </label>
              {emaRsiElement(pair, "1h", emaRsis1h, emaRsis1hColor)}
              {emaRsiElement(pair, "1d", emaRsis1d, emaRsis1dColor)}

              {/* <div className="bg-black border border-white rounded p-1 ml-2 w-36">
                {/* Row 1 * /}
                <div className="flex space-x-2">
                  <div>{pair}</div>
                  <a
                    href={`https://www.tradingview.com/chart/hwbr0Mgr/?symbol=BINANCE%3A${pair}`}
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

                {/* Row 2 * /}
                <div className="flex justify-between">
                  <div className="text-xs">${pairsPrices[pair].price}</div>
                  <div className="text-xs">
                    {pairsPrices[pair].numOfTransactions}
                  </div>
                </div>

                {/* Row 3 * /}
                {pairData1h[pair] && (
                  <div>
                    <CandlestickChart
                      data={pairData1h[pair].candles.slice(-30)}
                    />
                    <div className="flex space-x-2 text-xs">
                      {/*<span>{pairData1h[pair].ema7}</span>
                      <span>{pairData1h[pair].ema25}</span>
                      <span>{pairData1h[pair].ema100}</span>
                      <span>{pairData1h[pair].rsi}</span>* /}
                      <span>
                        EMA 100 diff:{" "}
                        <span
                          className={`text-${
                            pairData1h[pair].diffToEma100 > 0
                              ? "lime-600"
                              : "red-500"
                          }`}
                        >
                          {pairData1h[pair].diffToEma100.toFixed(2)}%
                        </span>
                      </span>
                    </div>
                  </div>
                )}

                {/* Row 4 * /}
                {pairData1d[pair] && (
                  <div>
                    <CandlestickChart
                      data={pairData1d[pair].candles.slice(-30)}
                    />
                    <div className="flex space-x-2 text-xs">
                      {/*<span>{pairData1h[pair].ema7}</span>
                      <span>{pairData1h[pair].ema25}</span>
                      <span>{pairData1h[pair].ema100}</span>
                      <span>{pairData1h[pair].rsi}</span>* /}
                      <span>
                        EMA 100 diff:{" "}
                        <span
                          className={`text-${
                            pairData1d[pair].diffToEma100 > 0
                              ? "lime-600"
                              : "red-500"
                          }`}
                        >
                          {pairData1d[pair].diffToEma100.toFixed(2)}%
                        </span>
                      </span>
                    </div>
                  </div>
                )}
              </div> */}
            </div>
          ))}
      </div>
    </>
  );
};

export default PairsAndPrices;
