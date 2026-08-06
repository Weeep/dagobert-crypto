import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Color } from "@/src/shared/ui/Color";
import { clientUseCases } from "@/src/shared/composition/clientUseCases";
import type { DagobertTransaction } from "@/src/modules/transaction";
import { TradeType } from "@/src/modules/transaction";
import {
  formatDate,
  getPrice,
  getTargetPrices,
  getTradeTypeColor,
  modifyLastDigit,
} from "@/utils/helper";
import {
  CancelOrderOptions,
  CandleChartResult,
  NewOrderLimit,
  NewOrderSL,
  OrderSide_LT,
  OrderType,
} from "binance-api-node";
import DFrame from "../DFrame";
import { m } from "framer-motion";
import * as d3 from "d3";
import CandlestickChart from "../CandlestickChart";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { DCandle, TradingAnalysis } from "../../lib/TradingAnalysis";


const getPairUseCase = clientUseCases.getPair;
const updateTransactionNoteUseCase = clientUseCases.updateTransactionNote;
const setOtherSideOrderUseCase = clientUseCases.setOtherSideOrder;
const clearOtherSideOrderUseCase = clientUseCases.clearOtherSideOrder;

type ChartInterval = "1h" | "1d";

interface ChartData {
  candles: DCandle[];
  diffPctToEma100: number;
}

interface Props {
  dtransaction: DagobertTransaction;
  currentPrice: number;
  clickOnCard: (transaction: DagobertTransaction) => void;
  clickOnPair: (pair: string) => void;
  isSelectionDisabled?: boolean;
  className?: string;
}

const DTransactionCard: React.FC<Props> = ({
  dtransaction,
  currentPrice,
  clickOnCard,
  clickOnPair,
  isSelectionDisabled = false,
  className = "",
}) => {
  const [isMarked, setIsMarked] = useState(false);
  const [numberStr, setNumberStr] = useState<string>(
    dtransaction.tradeType === TradeType.Margin ? "-10" : "10"
  );
  const [note, setNote] = useState<string>(dtransaction.note);
  const [inputValue, setInputValue] = useState("");
  const [editNote, setEditNote] = useState<boolean>(false);
  const [isChartOpen, setIsChartOpen] = useState(false);
  const [activeChartInterval, setActiveChartInterval] =
    useState<ChartInterval>("1h");
  const [chartData, setChartData] = useState<Record<ChartInterval, ChartData> | null>(null);
  const [isCandleChartLoading, setIsCandleChartLoading] = useState(false);
  const [chartError, setChartError] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [otherSideOrderId, setOtherSideOrderId] = useState(
    dtransaction.otherSideOrderId
  );
  const [errorMessage, setErrorMessage] = useState<[string, number]>(["", 0]);
  const isOtherSideOrder = !!otherSideOrderId;

  useEffect(() => {
    setOtherSideOrderId(dtransaction.otherSideOrderId);
  }, [dtransaction.otherSideOrderId]);

  useEffect(() => {
    if (!isChartOpen) return;

    const controller = new AbortController();

    const fetchInterval = async (interval: ChartInterval): Promise<ChartData> => {
      const response = await fetch(
        `/api/binanceapi/klines?symbol=${dtransaction.pair}&interval=${interval}&limit=111`,
        { signal: controller.signal }
      );
      const data = (await response.json()) as DCandle[];

      if (!response.ok || !Array.isArray(data)) {
        throw new Error("The chart data could not be loaded.");
      }

      const analysis = new TradingAnalysis(data, currentPrice);
      return {
        candles: data.slice(-30),
        diffPctToEma100: analysis.getEma(100).emaDiffPct ?? -1000,
      };
    };

    setIsCandleChartLoading(true);
    setChartError("");
    setChartData(null);

    Promise.all([fetchInterval("1h"), fetchInterval("1d")])
      .then(([hourly, daily]) => {
        setChartData({ "1h": hourly, "1d": daily });
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== "AbortError") {
          setChartError(error.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsCandleChartLoading(false);
      });

    return () => controller.abort();
  }, [isChartOpen, dtransaction.pair, currentPrice]);

  const handleNoteEnterPressed = async () => {
    const newNote = inputValue.trim();
    const result = await updateTransactionNoteUseCase.execute(
      dtransaction.orderId,
      newNote
    );

    if (result.ok) {
      setNote(result.transaction.note);
      setEditNote(false);
      setInputValue("");
    } else {
      setErrorMessage([result.error, new Date().getTime()]);
    }
  };

  const handleNoteClicked = (
    event: React.MouseEvent<HTMLSpanElement, MouseEvent>
  ) => {
    event.stopPropagation();
    setEditNote(true);
    setInputValue(note);
  };

  const handleCardClicked = () => {
    if (isSelectionDisabled) return;

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


  const getPairDecimals = async (pair: string): Promise<number | null> => {
    const result = await getPairUseCase.execute(pair);
    if (!result.ok) {
      setErrorMessage([result.error, new Date().getTime()]);
      return null;
    }

    return result.pair.decimals;
  };

  const handleNewTpBuyOrderClicked = async (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    event.stopPropagation();

    const number = Number(numberStr);
    if (isNaN(number)) {
      return;
    }

    const price = getTargetPrices(dtransaction.price, [number])[0];

    let order: NewOrderLimit | NewOrderSL = {
      symbol: dtransaction.pair,
      side: "BUY",
      quantity: dtransaction.executed.toString(),
      price: price.toString(),
      type: "LIMIT" as OrderType.LIMIT,
    };

    if (price >= currentPrice) {
      const decimals = await getPairDecimals(dtransaction.pair);
      if (decimals === null) {
        return;
      }
      const stopPrice = (price * 0.9996).toFixed(decimals);

      order = {
        symbol: order.symbol,
        side: order.side,
        quantity: order.quantity,
        price: order.price,
        type: "STOP_LOSS_LIMIT" as OrderType.STOP_LOSS_LIMIT,
        stopPrice: stopPrice.toString(),
      };
    }

    await newOrder("margin", order);
  };

  const handleNewSlSellOrderClicked = async (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    event.stopPropagation();

    const number = Number(numberStr);
    if (isNaN(number)) {
      return;
    }

    const price = getTargetPrices(dtransaction.price, [number])[0];

    let order: NewOrderLimit | NewOrderSL = {
      symbol: dtransaction.pair,
      side: "SELL",
      quantity: dtransaction.executed.toString(),
      price: price.toString(),
      type: "LIMIT" as OrderType.LIMIT,
    };

    if (price < currentPrice) {
      const decimals = await getPairDecimals(dtransaction.pair);
      if (decimals === null) {
        return;
      }
      const stopPrice = (price * 1.0004).toFixed(decimals);

      order = {
        symbol: order.symbol,
        side: order.side,
        quantity: order.quantity,
        price: order.price,
        type: "STOP_LOSS_LIMIT" as OrderType.STOP_LOSS_LIMIT,
        stopPrice: stopPrice.toString(),
      };
    }

    await newOrder("spot", order);
  };

  const newOrder = async (
    endpoint: string,
    order: NewOrderLimit | NewOrderSL
    // side: OrderSide_LT,
    // type: OrderType.STOP_LOSS_LIMIT | OrderType.TAKE_PROFIT_LIMIT,
    // endpoint: "spot" | "margin",
    // price: number,
    // modifier: number
  ) => {
    //const side = "SELL";
    //const type = "STOP_LOSS_LIMIT" as OrderType.STOP_LOSS_LIMIT;  //TAKE_PROFIT_LIMIT

    //const price = modifyLastDigit(stopPrice, modifier).toString();
    const apiUri = `/api/binanceapi/${endpoint}`;
    const response = await fetch(apiUri, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
    });

    const rjson = await response.json();

    if (response.ok) {
      const newNote = `${order.side} set to ${order.price} (${numberStr}%)`;
      const result = await setOtherSideOrderUseCase.execute({
        orderId: dtransaction.orderId,
        otherSideOrderId: rjson?.orderId ?? "",
        note: newNote,
      });

      if (result.ok) {
        setOtherSideOrderId(result.transaction.otherSideOrderId);
        setNote(result.transaction.note);
      } else {
        setErrorMessage([result.error, new Date().getTime()]);
      }
    } else {
      setNote("Failed to create order: " + rjson.error);
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
        const result = await clearOtherSideOrderUseCase.execute({
          orderId: dtransaction.orderId,
          note: "",
        });

        if (result.ok) {
          setOtherSideOrderId(result.transaction.otherSideOrderId);
          setNote(result.transaction.note);
        } else {
          setErrorMessage([result.error, new Date().getTime()]);
        }
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
    setActiveChartInterval("1h");
    setIsChartOpen(true);
  };

  const chartCancelClicked = (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ): void => {
    event.stopPropagation();
    setIsChartOpen(false);
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

  return (
    <DFrame
      className={className}
      errorMessage={errorMessage[0]}
      errorEpoch={errorMessage[1]}
    >
      <div
        onClick={handleCardClicked}
        aria-disabled={isSelectionDisabled}
        title={
          isSelectionDisabled
            ? "Only transactions with the same pair and trade type can be grouped"
            : undefined
        }
        className={`relative bg-${
          isMarked ? "blue" : "slate"
        }-100 p-4 rounded-md shadow-md ${
          isSelectionDisabled ? "cursor-not-allowed opacity-50" : ""
        }`}
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
          className={`absolute top-2 bottom-2 left-1 w-1 ${getTradeTypeColor(
            dtransaction.tradeType
          )} rounded-full`}
          title={`${dtransaction.tradeType} Order`}
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
                {isNaN(Number(numberStr))
                  ? ""
                  : getTargetPrices(dtransaction.price, [Number(numberStr)])[0]}
                $
              </span>

              <input
                type="text"
                inputMode="decimal"
                pattern="-?[0-9]*\.?[0-9]*"
                value={numberStr}
                onChange={(e) => {
                  const newVal = e.target.value;
                  if (
                    /^-?\d+(\.\d*)?$/.test(newVal) ||
                    newVal === "-" ||
                    newVal === ""
                  ) {
                    setNumberStr(newVal);
                  }
                }}
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
                    orderId: parseInt(otherSideOrderId),
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
            className="ml-2 self-end rounded-md border border-slate-300 bg-white/70 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600"
          >
            Chart
          </button>
        </div>

        {/* Row 6*/}
        <div className="text-xs text-right text-gray-300 italic">
          {d3.timeFormat("%y-%m-%d %H:%M")(new Date(dtransaction.dateEpoch))} |{" "}
          {dtransaction.orderId.slice(-6)} | {dtransaction.tradeStyle}
        </div>

        {isChartOpen && (
          <div
            onClick={(event) => event.stopPropagation()}
            className="absolute inset-1 z-20 overflow-hidden rounded-lg border border-slate-700 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-3 text-slate-100 shadow-2xl"
            role="dialog"
            aria-label={`${dtransaction.pair} price chart`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex rounded-lg bg-slate-800 p-1" aria-label="Chart interval">
                  {(["1h", "1d"] as ChartInterval[]).map((interval) => (
                    <button
                      key={interval}
                      type="button"
                      onClick={() => setActiveChartInterval(interval)}
                      className={`min-w-10 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                        activeChartInterval === interval
                          ? "bg-blue-500 text-white shadow"
                          : "text-slate-400 hover:bg-slate-700 hover:text-white"
                      }`}
                      aria-pressed={activeChartInterval === interval}
                    >
                      {interval === "1h" ? "1h" : "D"}
                    </button>
                  ))}
                </div>
                <div>
                  <div className="text-sm font-semibold tracking-wide">{dtransaction.pair}</div>
                  <div className="text-[10px] text-slate-400">
                    {activeChartInterval === "1h" ? "Hourly candles" : "Daily candles"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={chartCancelClicked}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-300 transition-colors hover:border-slate-500 hover:bg-slate-700 hover:text-white"
                aria-label="Close chart"
                title="Close chart"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="relative mt-2 flex min-h-36 flex-1 items-center justify-center">
              {isCandleChartLoading && (
                <div className="flex flex-col items-center gap-2 text-slate-400" role="status">
                  <FontAwesomeIcon icon={faSpinner} className="h-5 w-5 animate-spin text-blue-400" />
                  <span className="text-xs">Loading market data…</span>
                </div>
              )}
              {!isCandleChartLoading && chartError && (
                <div className="rounded-lg border border-red-900/70 bg-red-950/50 px-4 py-3 text-center text-xs text-red-300">
                  {chartError}
                </div>
              )}
              {!isCandleChartLoading && chartData && (
                <div className="w-full">
                  <CandlestickChart data={chartData[activeChartInterval].candles} />
                  <div className="mt-1 flex items-center justify-between border-t border-slate-800 pt-2 text-xs text-slate-400">
                    <span>EMA 100 distance</span>
                    <span className={chartData[activeChartInterval].diffPctToEma100 > 0 ? "font-semibold text-emerald-400" : "font-semibold text-rose-400"}>
                      {chartData[activeChartInterval].diffPctToEma100 > 0 ? "+" : ""}
                      {chartData[activeChartInterval].diffPctToEma100.toFixed(2)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
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
