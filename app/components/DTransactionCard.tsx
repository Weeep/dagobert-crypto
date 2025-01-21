import React, { useEffect, useState } from "react";
import { DagobertTransaction, KVRoot } from "@/utils/typesAndEnums";
import {
  decreaseLastDigitByTwo,
  formatDate,
  getPrice,
  getTargetPrices,
} from "@/utils/helper";
import ClientSideDbCache from "../lib/ClientSideDbCache";
import { CancelOrderOptions, NewOrderSL, OrderType } from "binance-api-node";

interface Props {
  dtransaction: DagobertTransaction;
  currentPrice: number;
  onClick: (
    transaction: DagobertTransaction,
    remove: boolean,
    handleVisibility: (isVisible: boolean) => void
  ) => void;
}

const DTransactionCard: React.FC<Props> = ({
  dtransaction,
  currentPrice,
  onClick,
}) => {
  const [isMarked, setIsMarked] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [number, setNumber] = useState(10);
  const [note, setNote] = useState<string>(dtransaction.note);
  const [inputValue, setInputValue] = useState("");
  const [editNote, setEditNote] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOtherSideOrder, setIsOtherSideOrder] = useState(false);

  useEffect(() => {
    setIsOtherSideOrder(!!dtransaction.otherSideOrderId);
  }, []);

  const handleEnterNewNote = async () => {
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

  const handleClickOnNote = (
    event: React.MouseEvent<HTMLSpanElement, MouseEvent>
  ) => {
    event.stopPropagation();
    setEditNote(true);
    setInputValue(note);
  };

  const toggleSelection = () => {
    onClick(dtransaction, !isMarked, setIsVisible);
    setIsMarked(!isMarked);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNumber(Number(event.target.value));
  };

  const getProfit = (): number => {
    return parseFloat(
      (currentPrice * dtransaction.executed + dtransaction.amount).toFixed(2)
    );
  };

  const postNewSlOrder = async (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    event.stopPropagation();

    const price = getTargetPrices(dtransaction.price, [number])[0];

    const newSlOrder: NewOrderSL = {
      symbol: dtransaction.pair,
      side: "SELL",
      type: "STOP_LOSS_LIMIT" as OrderType.STOP_LOSS_LIMIT,
      quantity: dtransaction.executed.toString(),
      price: decreaseLastDigitByTwo(price).toString(),
      stopPrice: price.toString(),
    };

    const response = await fetch("/api/binanceapi/allOrders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSlOrder),
    });

    if (response.ok) {
      const newNote = { note: `Sell set to ${price} (${number}%)` };
      const newOtherSideOrderId = {
        otherSideOrderId: (await response.json())?.orderId ?? "",
      };
      await ClientSideDbCache.hset(KVRoot.dtransactions, {
        [dtransaction.orderId]: {
          ...dtransaction,
          ...newNote,
          ...newOtherSideOrderId,
        },
      });

      setNote(newNote.note);
    } else {
      setNote("failed to create sl order: " + JSON.stringify(response));
    }
  };

  const handleClickCancelOrder = async (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    options: CancelOrderOptions
  ) => {
    event.stopPropagation();

    const response = await fetch("/api/binanceapi/allOrders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });

    const rjson = await response.json();

    if (response.ok || rjson.errorCode === -2011) {
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
      setNote(
        "failed to cancel sl order. Options: " +
          JSON.stringify(options) +
          " Repsonse: " +
          JSON.stringify(await response.json())
      );
    }
  };

  const handleSellClick = (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    event.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div
      onClick={toggleSelection}
      className={`bg-${
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
        TODO: It looks without these the below coloring does not work
      </div>

      {/* Row 1 */}
      <div className="flex justify-center font-semibold mb-2 text-black">
        {[
          ["Pair", dtransaction.pair],
          ["Price", dtransaction.price.toString()],
          ["Executed", dtransaction.executed.toString()],
        ].map((cardElement: string[], index: number) => {
          return (
            <div key={index} className="w-1/3 text-center">
              <div className="text-xs text-gray-400">{cardElement[0]}</div>
              <div className="text-xl">{cardElement[1]}</div>
            </div>
          );
        })}
      </div>

      {/* Row 2 */}
      <div className="flex justify-center mb-2 text-black">
        {[
          ["Date", formatDate(dtransaction.dateEpoch), ""],
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
        {dtransaction.side === "BUY" && (
          <>
            Current price: <b>{currentPrice}</b> || Profit:{" "}
            <span
              className={`text-${
                getProfit() > 0 ? "lime-600" : "red-500"
              } font-bold`}
            >
              {getProfit()}$ (
              {(100 * (currentPrice / dtransaction.price - 1)).toFixed(2)}%)
            </span>
          </>
        )}
      </div>

      {/* Row 4 */}
      <div className={`relative overflow-hidden w-full h-8 rounded-lg text-xs`}>
        {dtransaction.side === "BUY" && (
          <div
            className={`absolute bg-blue-500 h-8 text-gray-100 flex justify-self-end transition-all duration-300 ease-in-out ${
              isExpanded ? "left-0" : "left-full -ml-6"
            } rounded-l-full w-full pr-12 items-center`}
          >
            <button
              onClick={(event) => handleSellClick(event)}
              className="pl-1 pr-2 text-left flex-grow font-bold "
            >
              {isExpanded ? ">" : "<"}
            </button>
            <span className="text-white pr-2">
              Sell on {getTargetPrices(dtransaction.price, [number])[0]}$
            </span>

            <input
              type="number"
              value={number}
              onChange={handleChange}
              onClick={(event) => event.stopPropagation()}
              className="w-14 px-2 py-1 text-black border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={(event) => postNewSlOrder(event)}
              className="bg-red-100 text-black rounded-full ml-2 px-2 text-center flex-grow"
            >
              SELL
            </button>
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
      <div className="mt-2 text-xs">
        {note !== "" && !editNote && (
          <span
            onClick={(event) => handleClickOnNote(event)}
            className="text-gray-700 px-2 py-1 cursor-pointer"
          >
            {note}
          </span>
        )}
        {isOtherSideOrder && (
          <button
            onClick={(event) =>
              handleClickCancelOrder(event, {
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
            onKeyDown={(e) => e.key === "Enter" && handleEnterNewNote()}
            placeholder="Add a note"
            className="text-xs text-black px-2 py-1 border rounded w-full"
          />
        )}
      </div>
    </div>
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
