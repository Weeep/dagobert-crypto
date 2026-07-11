import { ReactElement, useEffect, useState } from "react";
import { PairPriceIf } from "../../lib/Interfaces";
import Image from "next/image";
import {
  convertArrayToObject as arrayToObject,
  redCross,
} from "@/utils/helper";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight } from "@fortawesome/free-solid-svg-icons";
import {
  KvTransactionRepository,
  ListOpenTransactionsUseCase,
} from "@/src/modules/transaction";
import { KvPairRepository, ListPairsUseCase } from "@/src/modules/pair";
import { faRefresh } from "@fortawesome/free-solid-svg-icons";
import { DCandle, TradingAnalysis } from "../../lib/TradingAnalysis";


const pairRepository = new KvPairRepository();
const transactionRepository = new KvTransactionRepository();
const listPairsUseCase = new ListPairsUseCase(pairRepository);
const listOpenTransactionsUseCase = new ListOpenTransactionsUseCase(
  transactionRepository
);

type Indicators = {
  ema7: number;
  ema25: number;
  ema100: number;
  rsi6: number;
  min: number;
  max: number;
  diffPctMin: number;
  diffPctMax: number;
  isBull: boolean;
  isBear: boolean;
};

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
    [key: string]: Indicators;
  }>({});
  const [emaRsis1hColor, setEmaRsis1hColor] = useState<{
    [key: string]: {
      ema100: string; //"text-red-500" | "text-lime-500" | "text-gray-700";
      rsi6: string; //"text-red-500" | "text-lime-500" | "text-gray-700";
    };
  }>({});
  const [emaRsis1d, setEmaRsis1d] = useState<{
    [key: string]: Indicators;
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
      const minMax = ta.getMinMax(30);
      const ema7DiffPct = ta.getEma(7).emaDiffPct ?? -400;
      const ema25DiffPct = ta.getEma(25).emaDiffPct ?? -400;
      const ema100DiffPct = ta.getEma(100).emaDiffPct ?? -400;
      const pairEmaRsi: Indicators = {
        rsi6: ta.getRsi(6) ?? -1,
        ema7: ema7DiffPct,
        ema25: ema25DiffPct,
        ema100: ema100DiffPct,
        min: minMax.min,
        max: minMax.max,
        diffPctMin: minMax.currentPriceMinDiffPct,
        diffPctMax: minMax.currentPriceMaxDiffPct,
        isBull: ta.isBull(ema7DiffPct, ema25DiffPct, ema100DiffPct),
        isBear: ta.isBear(ema7DiffPct, ema25DiffPct, ema100DiffPct),
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
    const pairs = await listPairsUseCase.execute();
    if (pairs.length === 0) {
      setPairInfo("No any pair defined. Go to Config and add some.");
      return null;
    }

    const response = await fetch(
      `/api/binanceapi/tickerPrice?symbols=${JSON.stringify(
        pairs.map((pair) => pair.pair)
      )}`
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

    const numOfTransactions = await getOpenTransactionCountsByPair();

    for (const price of prices as PairPriceIf[]) {
      price.numOfTransactions = numOfTransactions[price.pair] ?? 0;
    }

    return arrayToObject(prices as PairPriceIf[], "pair");
  };

  const getOpenTransactionCountsByPair = async (): Promise<{
    [pair: string]: number;
  }> => {
    const openTransactions = await listOpenTransactionsUseCase.execute();

    return openTransactions.reduce<{ [pair: string]: number }>(
      (acc, transaction) => {
        acc[transaction.pair] = (acc[transaction.pair] ?? 0) + 1;
        return acc;
      },
      {}
    );
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
      [key: string]: Indicators;
    },
    emaRsiDataColor: {
      [key: string]: { ema100: string; rsi6: string };
    }
  ): ReactElement {
    const rsiColor = emaRsiDataColor[pair]?.rsi6 ?? "text-gray-700";
    const rsi = emaRsiData[pair]?.rsi6.toFixed(2) ?? "...";
    const emaColor = emaRsiDataColor[pair]?.ema100 ?? "text-gray-700";
    const ema7 = emaRsiData[pair]?.ema7.toFixed(2) ?? "...";
    const ema25 = emaRsiData[pair]?.ema25.toFixed(2) ?? "...";
    const ema100 = emaRsiData[pair]?.ema100.toFixed(2) ?? "...";

    const min = emaRsiData[pair]?.min ?? "...";
    const max = emaRsiData[pair]?.max ?? "...";
    const diffMin = emaRsiData[pair]?.diffPctMin.toFixed(2) ?? "...";
    const diffMax = emaRsiData[pair]?.diffPctMax.toFixed(2) ?? "...";
    const isBull = emaRsiData[pair]?.isBull;
    const isBear = emaRsiData[pair]?.isBear;

    return (
      <>
        <div className="text-xs flex flex-col items-center space-x-1 border border-dotted p-1">
          <span>
            {interval} RSI(6): <span className={rsiColor}>{rsi}</span>
          </span>
          <span>
            Ema7: <span>{ema7}</span>
          </span>
          <span>
            Ema25: <span>{ema25}</span>
          </span>
          <span>
            Ema100: <span className={emaColor}>{ema100}</span>
          </span>
          <span
            className={
              Number(diffMin) - Number(diffMax) > 10 && interval === "60"
                ? "text-yellow-100"
                : "text-white-100"
            }
          >
            {diffMin}% {diffMax}%
          </span>
          <div className="flex">
            <a
              href={`https://www.tradingview.com/chart/hwbr0Mgr/?symbol=BINANCE%3A${pair}&interval=${interval}`}
              target="_blank"
            >
              <Image
                src="/images/white-short-logo.png"
                alt="tradingview-logo"
                width={22}
                height={22}
              />
            </a>
            {isBull && (
              <div
                className="size-[22px] inline-block 
                  bg-[#00FF7F]                       
                  [mask-image:url('/images/bull.png')]
                  [mask-size:contain]
                  [mask-repeat:no-repeat]
                  [mask-position:center]
                  [-webkit-mask-image:url('/images/bull.png')]
                  [-webkit-mask-size:contain]
                  [-webkit-mask-repeat:no-repeat]
                  [-webkit-mask-position:center]"
              ></div>
            )}
            {isBear && (
              <div
                className="size-[22px] inline-block 
                  bg-[#EB4253]                       
                  [mask-image:url('/images/bear.png')]
                  [mask-size:contain]
                  [mask-repeat:no-repeat]
                  [mask-position:center]
                  [-webkit-mask-image:url('/images/bear.png')]
                  [-webkit-mask-size:contain]
                  [-webkit-mask-repeat:no-repeat]
                  [-webkit-mask-position:center]"
              ></div>
            )}
          </div>
        </div>
        {/*<span className="text-xs">
          {min} ({diffMin}%) | {max} ({diffMax}%)
        </span>*/}
      </>
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
              <div className="flex gap-2">
                {emaRsiElement(pair, "60", emaRsis1h, emaRsis1hColor)}
                {emaRsiElement(pair, "D", emaRsis1d, emaRsis1dColor)}
              </div>

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
