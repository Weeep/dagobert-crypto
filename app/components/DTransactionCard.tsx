import React, { ReactElement, useEffect, useState } from "react";
import Image from "next/image";
import {
  Color,
  DagobertTransaction,
  KVRoot,
  TradeType,
} from "@/utils/typesAndEnums";
import {
  decreaseLastDigitByTwo,
  formatDate,
  getPrice,
  getTargetPrices,
  modifyLastDigit,
} from "@/utils/helper";
import ClientSideDbCache from "../lib/ClientSideDbCache";
import {
  CancelOrderOptions,
  CandleChartResult,
  NewOrderSL,
  OrderSide_LT,
  OrderType,
} from "binance-api-node";
import DFrame from "./DFrame";
import { m } from "framer-motion";
import * as d3 from "d3";
import CandlestickChart from "./CandlestickChart";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { DCandle, TradingAnalysis } from "../lib/TradingAnalysis";

interface Props {
  dtransaction: DagobertTransaction;
  currentPrice: number;
  clickOnCard: (transaction: DagobertTransaction) => void;
  clickOnPair: (pair: string) => void;
  className?: string;
}

const DTransactionCard: React.FC<Props> = ({
  dtransaction,
  currentPrice,
  clickOnCard,
  clickOnPair,
  className = "",
}) => {
  const [isMarked, setIsMarked] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [number, setNumber] = useState(
    dtransaction.tradeType === TradeType.Margin ? -10 : 10
  );
  const [note, setNote] = useState<string>(dtransaction.note);
  const [inputValue, setInputValue] = useState("");
  const [editNote, setEditNote] = useState<boolean>(false);
  const [candleChart, setCandleChart] = useState<ReactElement>(<></>);
  const [isCandleChartLoading, setIsCandleChartLoading] =
    useState<boolean>(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOtherSideOrder, setIsOtherSideOrder] = useState(false);
  const [errorMessage, setErrorMessage] = useState<[string, number]>(["", 0]);

  useEffect(() => {
    setIsOtherSideOrder(!!dtransaction.otherSideOrderId);
  }, []);

  const handleNoteEnterPressed = async () => {
    const newNote = { note: inputValue.trim() };

    await ClientSideDbCache.hset(KVRoot.dtransactions, {
      [dtransaction.orderId]: {
        ...dtransaction,
        ...newNote,
      },
    });

    setNote(inputValue.trim());
    setEditNote(false);
    setInputValue("");
  };

  const handleNoteClicked = (
    event: React.MouseEvent<HTMLSpanElement, MouseEvent>
  ) => {
    event.stopPropagation();
    setEditNote(true);
    setInputValue(note);
  };

  const handleCardClicked = () => {
    clickOnCard(dtransaction);
    setIsMarked(!isMarked);
  };

  const handlePairClicked = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
    pair: string
  ) => {
    event.stopPropagation();
    clickOnPair(pair);
  };

  const handleSellPctChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNumber(Number(event.target.value));
  };

  const handleNewTpBuyOrderClicked = async (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    event.stopPropagation();
    await newOrder(
      "BUY",
      "STOP_LOSS_LIMIT" as OrderType.STOP_LOSS_LIMIT,
      "margin",
      2
    );
  };

  const handleNewSlSellOrderClicked = async (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    event.stopPropagation();
    await newOrder(
      "SELL",
      "STOP_LOSS_LIMIT" as OrderType.STOP_LOSS_LIMIT,
      "spot",
      -2
    );
  };

  const newOrder = async (
    side: OrderSide_LT,
    type: OrderType.STOP_LOSS_LIMIT | OrderType.TAKE_PROFIT_LIMIT,
    endpoint: "spot" | "margin",
    modifier: number
  ) => {
    const stopPrice = getTargetPrices(dtransaction.price, [number])[0];

    //const side = "SELL";
    //const type = "STOP_LOSS_LIMIT" as OrderType.STOP_LOSS_LIMIT;  //TAKE_PROFIT_LIMIT
    const price = modifyLastDigit(stopPrice, modifier).toString();
    const apiUri = `/api/binanceapi/${endpoint}`;

    const newOrder: NewOrderSL = {
      symbol: dtransaction.pair,
      side: side,
      type: type,
      quantity: dtransaction.executed.toString(),
      price: price,
      stopPrice: stopPrice.toString(),
    };

    const response = await fetch(apiUri, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newOrder),
    });

    const rjson = await response.json();

    if (response.ok) {
      const newNote = { note: `${side} set to ${stopPrice} (${number}%)` };
      const newOtherSideOrderId = {
        otherSideOrderId: rjson?.orderId ?? "",
      };
      await ClientSideDbCache.hset(KVRoot.dtransactions, {
        [dtransaction.orderId]: {
          ...dtransaction,
          ...newNote,
          ...newOtherSideOrderId,
        },
      });

      dtransaction.otherSideOrderId = newOtherSideOrderId.otherSideOrderId;
      setIsOtherSideOrder(true);
      setNote(newNote.note);
    } else {
      setNote("failed to create sl order: " + JSON.stringify(response));
    }
  };

  const handleCancelClicked = async (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    options: CancelOrderOptions
  ) => {
    event.stopPropagation();

    try {
      let endpoint = dtransaction.tradeType.toString().toLowerCase();

      const response = await fetch(`/api/binanceapi/${endpoint}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
      });

      const rjson = await response.json();

      if (response.ok || rjson?.error?.code === -2011) {
        //"Unknown order sent" - TODO??
        const newNote = { note: "" };
        const newOtherSideOrderId = { otherSideOrderId: "" };
        await ClientSideDbCache.hset(KVRoot.dtransactions, {
          [dtransaction.orderId]: {
            ...dtransaction,
            ...newNote,
            ...newOtherSideOrderId,
          },
        });
        setIsOtherSideOrder(false);
        setNote(newNote.note);
      } else {
        setErrorMessage([
          "failed to cancel sl order. Options: " +
            JSON.stringify(options) +
            " Repsonse: " +
            JSON.stringify(rjson),
          new Date().getTime(),
        ]);
      }
    } catch (error) {
      setErrorMessage([JSON.stringify(error), new Date().getTime()]);
    }
  };

  const handleSellClicked = (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    event.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const chartClicked = (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ): void => {
    event.stopPropagation();
    setCandleChart(
      <div
        onClick={(event) => {
          event.stopPropagation();
        }}
        className="absolute inset-1 bg-black"
        title="Chart"
      >
        <button
          onClick={(event) => chartCancelClicked(event)}
          className="absolute top-2 right-2 text-white"
        >
          X
        </button>

        {isCandleChartLoading && (
          <FontAwesomeIcon
            icon={faSpinner}
            className="absolute m-auto inset-0 animate-spin text-blue-500"
          />
        )}

        {loadChart()}
      </div>
    );
  };

  const chartCancelClicked = (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ): void => {
    event.stopPropagation();
    setIsCandleChartLoading(true);
    setCandleChart(<></>);
  };

  const loadChart = async (): Promise<ReactElement> => {
    let klines = {
      "1h": {
        ema7: -1,
        ema25: -1,
        ema100: -1,
        rsi: -1,
        diffPctToEma100: -1000,
        candles: [] as DCandle[],
      },
      "1d": {
        ema7: -1,
        ema25: -1,
        ema100: -1,
        rsi: -1,
        diffPctToEma100: -1000,
        candles: [] as DCandle[],
      },
    };
    const pair = dtransaction.pair;

    for (const interval of Object.keys(klines)) {
      const response = await fetch(
        `/api/binanceapi/klines?symbol=${pair}&interval=${interval}&limit=111`
      );

      const data: DCandle[] = (await response.json()) as DCandle[];
      if (response.status !== 200 || !Array.isArray(data)) {
        console.error(
          "error: " + response.status + " | " + JSON.stringify(data)
        ); //TODO
        return <>Error</>;
      } else {
        const ta = new TradingAnalysis(data, currentPrice);

        const ema7 = ta.getEma(7);
        const ema25 = ta.getEma(25);
        const ema100 = ta.getEma(100);

        const d = {
          ema7: ema7.ema ?? -1,
          ema25: ema25.ema ?? -1,
          ema100: ema100.ema ?? -1,
          rsi: ta.getRsi(6) ?? -1,
          diffPctToEma100: ema100.emaDiffPct ?? -1000,
          candles: data,
        };

        switch (interval) {
          case "1h":
            klines["1h"] = d;
            break;
          case "1d":
            klines["1d"] = d;
            break;
        }
      }
    }

    setIsCandleChartLoading(false);

    return (
      <div className="flex">
        <div className="w-1/2">
          <CandlestickChart data={klines["1h"].candles.slice(-30)} />
          <div className="flex space-x-2 text-xs">
            {/*<span>{pairData1h[pair].ema7}</span>
      <span>{pairData1h[pair].ema25}</span>
      <span>{pairData1h[pair].ema100}</span>
      <span>{pairData1h[pair].rsi}</span>*/}
            <span>
              EMA 100 diff:{" "}
              <span
                className={`text-${
                  klines["1h"].diffPctToEma100 > 0 ? "lime-600" : "red-500"
                }`}
              >
                {klines["1h"].diffPctToEma100.toFixed(2)}%
              </span>
            </span>
          </div>
        </div>

        <div className="w-1/2">
          <CandlestickChart data={klines["1d"].candles.slice(-30)} />
          <div className="flex space-x-2 text-xs">
            {/*<span>{pairData1h[pair].ema7}</span>
      <span>{pairData1h[pair].ema25}</span>
      <span>{pairData1h[pair].ema100}</span>
      <span>{pairData1h[pair].rsi}</span>*/}
            <span>
              EMA 100 diff:{" "}
              <span
                className={`text-${
                  klines["1d"].diffPctToEma100 > 0 ? "lime-600" : "red-500"
                }`}
              >
                {klines["1d"].diffPctToEma100.toFixed(2)}%
              </span>
            </span>
          </div>
        </div>
      </div>
    );
  };

  const getProfit = (tradeType: TradeType): number => {
    switch (tradeType) {
      case TradeType.Spot:
        return parseFloat(
          (currentPrice * dtransaction.executed + dtransaction.amount).toFixed(
            2
          )
        );
      case TradeType.Margin:
        return parseFloat(
          (dtransaction.amount - currentPrice * dtransaction.executed).toFixed(
            2
          )
        );
      default:
        return -1;
    }
  };

  const getColor = (t: TradeType): string => {
    switch (t) {
      case TradeType.Spot:
        return "bg-" + Color.SpotColor;
      case TradeType.Margin:
        return "bg-" + Color.MarginColor;
      default:
        return "";
    }
  };

  return (
    <DFrame
      className={className}
      errorMessage={errorMessage[0]}
      errorEpoch={errorMessage[1]}
    >
      <div
        onClick={handleCardClicked}
        className={`relative bg-${
          isMarked ? "blue" : "slate"
        }-100 p-4 rounded-md shadow-md ${isVisible ? "" : "hidden"}`}
      >
        <div style={{ display: "none" }}>
          <span className="bg-red-100"></span>
          <span className="bg-green-100"></span>
          <span className="bg-slate-100"></span>
          <span className="bg-blue-100"></span>
          <span className="text-lime-600"></span>
          <span className="text-red-500"></span>
          <span className={`bg-${Color.SpotColor}`}></span>
          <span className={`bg-${Color.MarginColor}`}></span>
          TODO: It looks without these the below coloring does not work
        </div>

        <div
          className={`absolute top-2 bottom-2 left-1 w-1 ${getColor(
            dtransaction.tradeType
          )} rounded-full`}
          title="Spot Order"
        ></div>

        {/* Row 1 */}
        <div className="flex justify-center font-semibold mb-2 text-black">
          {/* {[
            ["Pair", dtransaction.pair],
            ["Executed", dtransaction.executed.toString()],
          ].map((cardElement: string[], index: number) => {
            return ( */}
          <div /*key={index}*/ className="w-1/2 text-center">
            <div className="text-xs text-gray-400">Pair</div>
            {/*<div className="text-xl">{dtransaction.pair}</div>*/}
            <div className="flex space-x-1 justify-center items-center">
              <div
                className="text-xl cursor-pointer"
                onClick={(event) => handlePairClicked(event, dtransaction.pair)}
              >
                {dtransaction.pair}
              </div>
              <a
                href={`https://www.tradingview.com/chart/hwbr0Mgr/?symbol=BINANCE%3A${dtransaction.pair}`}
                target="_blank"
              >
                <Image
                  src="/images/black-short-logo.png"
                  alt="tradingview-logo"
                  width={24}
                  height={24}
                />
              </a>
            </div>
          </div>
          <div /*key={index}*/ className="w-1/2 text-center">
            <div className="text-xs text-gray-400">Executed</div>
            <div className="text-xl">{dtransaction.executed}</div>
          </div>
          {/*   );*/}
          {/* })}*/}
        </div>

        {/* Row 2 */}
        <div className="flex justify-center mb-2 text-black">
          {[
            /*["Date", formatDate(dtransaction.dateEpoch), ""],*/
            ["Price", dtransaction.price.toString(), ""],
            [
              "Side",
              dtransaction.side,
              dtransaction.side === "BUY" ? "bg-green-100" : "bg-red-100",
            ],
            [
              "Amount",
              (dtransaction.amount >= 0
                ? "+" + dtransaction.amount
                : dtransaction.amount
              ).toString(),
              "",
            ],
          ].map((cardElement: string[], index: number) => {
            return (
              <div key={index} className="w-1/3 text-center">
                <div className="text-xs text-gray-400">{cardElement[0]}</div>
                <div className={cardElement[2]}>{cardElement[1]}</div>
              </div>
            );
          })}
        </div>

        {/* Row 3 */}
        <div className="h-4 text-xs text-center px-3 text-black mb-2">
          {((dtransaction.side === "BUY" &&
            dtransaction.tradeType === TradeType.Spot) ||
            (dtransaction.side === "SELL" &&
              dtransaction.tradeType === TradeType.Margin)) && (
            <>
              Current price: <b>{currentPrice}</b> || Profit:{" "}
              <span
                className={`text-${
                  getProfit(dtransaction.tradeType) > 0 ? "lime-600" : "red-500"
                } font-bold`}
              >
                {getProfit(dtransaction.tradeType)}$ (
                {(100 * (currentPrice / dtransaction.price - 1)).toFixed(2)}%)
              </span>
            </>
          )}
        </div>

        {/* Row 4 */}
        <div
          className={`relative overflow-hidden w-full h-8 rounded-lg text-xs`}
        >
          {((dtransaction.side === "BUY" &&
            dtransaction.tradeType === TradeType.Spot) ||
            (dtransaction.side === "SELL" &&
              dtransaction.tradeType === TradeType.Margin)) && (
            <div
              className={`absolute bg-blue-500 h-8 text-gray-100 flex justify-self-end transition-all duration-300 ease-in-out ${
                isExpanded ? "left-0" : "left-full -ml-6"
              } rounded-l-full w-full pr-12 items-center`}
            >
              <button
                onClick={(event) => handleSellClicked(event)}
                className="pl-1 pr-2 text-left flex-grow font-bold "
              >
                {isExpanded ? ">" : "<"}
              </button>
              <span className="text-white pr-2">
                {dtransaction.side === "BUY" ? "Sell" : "Buy"} on{" "}
                {getTargetPrices(dtransaction.price, [number])[0]}$
              </span>

              <input
                type="number"
                value={number}
                onChange={handleSellPctChanged}
                onClick={(event) => event.stopPropagation()}
                className="w-14 px-2 py-1 text-black border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {dtransaction.tradeType === TradeType.Spot && (
                <button
                  onClick={(event) => handleNewSlSellOrderClicked(event)}
                  className="bg-red-100 text-black rounded-full ml-2 px-2 text-center flex-grow"
                >
                  SELL
                </button>
              )}
              {dtransaction.tradeType === TradeType.Margin && (
                <button
                  onClick={(event) => handleNewTpBuyOrderClicked(event)}
                  className="bg-green-100 text-black rounded-full ml-2 px-2 text-center flex-grow"
                >
                  BUY
                </button>
              )}
            </div>
          )}
        </div>

        {/* Row 4 - percentage calculations 
      <div className="h-4 flex text-xs items-center justify-between px-3 text-gray-400">
        {dtransaction.side === "BUY" && (
          <div>
            {getTargetPrices(dtransaction.price, [-5, -3, 3, 5, 10]).map(
              (item, index) => (
                <span key={index}>| {item} |</span>
              )
            )}
          </div>
        )}
        {/*
          <span>| </span>
          <button
            onClick={(event) => postNewSlOrder(event)}
            className="text-blue-600"
          >
            {getTargetPrices(dtransaction.price, [number])[0]}
          </button>
        </div>
        <input
          type="number"
          value={number}
          onChange={handleChange}
          onClick={(event) => event.stopPropagation()}
          className="w-12 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />*
      </div>*/}

        {/* Row 5 - Note */}
        <div className="flex justify-between">
          <div className="mt-2 mr-2 w-full text-xs">
            {note !== "" && !editNote && (
              <span
                onClick={(event) => handleNoteClicked(event)}
                className="text-gray-700 px-2 py-1 cursor-pointer"
              >
                {note}
              </span>
            )}
            {isOtherSideOrder && (
              <button
                onClick={(event) =>
                  handleCancelClicked(event, {
                    orderId: parseInt(dtransaction.otherSideOrderId),
                    symbol: dtransaction.pair,
                  })
                }
                className="text-blue-600"
              >
                Cancel
              </button>
            )}
            {(note === "" || note === undefined || editNote) && (
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(e) => e.key === "Enter" && handleNoteEnterPressed()}
                placeholder="Add a note"
                className="text-xs text-black px-2 py-1 border rounded w-full"
              />
            )}
          </div>
          <button
            onClick={(event) => chartClicked(event)}
            className="text-xs text-black"
          >
            chart
          </button>
        </div>

        {/* Row 6*/}
        <div className="text-xs text-right text-gray-300 italic">
          {d3.timeFormat("%y-%m-%d %H:%M")(new Date(dtransaction.dateEpoch))} |{" "}
          {dtransaction.orderId.slice(-6)} | {dtransaction.tradeStyle}
        </div>

        {candleChart}
      </div>
    </DFrame>
  );
};

function getDate(epoch: number): string {
  const d = new Date(epoch);
  return (
    d.getFullYear() +
    "-" +
    d.getMonth() +
    "-" +
    d.getDay() +
    " " +
    d.getHours() +
    ":" +
    d.getMinutes() +
    ":" +
    d.getSeconds() +
    "." +
    d.getMilliseconds()
  );
}

export default DTransactionCard;

/*

spot sell sl - ha eladni akarsz alacsonyabb áron mint a current 
spot buy tp - ha eladni akarsz magasabb áron mint a mostani (ua mint spot buy l(imit))

margin sell sl
margin sell tp
margin buy sl
margin buy tp



*/
