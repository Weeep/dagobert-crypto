import React, { useEffect, useState } from "react";
import { DagobertTransaction, KVRoot } from "@/utils/typesAndEnums";
import { formatDate, getPrice, getTargetPrices } from "@/utils/helper";
import ClientSideDbCache from "../lib/ClientSideDbCache";

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
  const [number, setNumber] = useState(0);

  const [note, setNote] = useState<string>(dtransaction.note);
  const [inputValue, setInputValue] = useState("");
  const [editNote, setEditNote] = useState<boolean>(false);

  const handleEnterDown = async () => {
    //e: React.KeyboardEvent<HTMLInputElement>) => {
    if (inputValue.trim()) {
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
    }
  };

  const handleClickOnNote = () => {
    setEditNote(true);
    setInputValue(note);
  };

  const toggleSelection = () => {
    onClick(dtransaction, !isMarked, setIsVisible);
    setIsMarked(!isMarked);
    //setIsVisible(false);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNumber(Number(event.target.value));
  };

  const getProfit = (): number => {
    return parseFloat(
      (currentPrice * dtransaction.executed + dtransaction.amount).toFixed(2)
    );
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
      <div className="text-xs text-center px-3 text-black mb-2">
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
      <div className="flex text-xs items-center justify-between px-3 text-gray-400">
        <div>
          {getTargetPrices(dtransaction.price, [-5, -3, 3, 5, 10]).map(
            (item, index) => (
              <span key={index}>| {item} |</span>
            )
          )}

          <span>| {getTargetPrices(dtransaction.price, [number])[0]}</span>
        </div>
        <input
          type="number"
          value={number}
          onChange={handleChange}
          onClick={(event) => event.stopPropagation()}
          className="w-12 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Row 5 */}
      <div className="mt-2 text-xs">
        {note !== "" && !editNote && (
          <div
            onClick={handleClickOnNote}
            className="text-gray-700 px-2 py-1 cursor-pointer"
          >
            {note}
          </div>
        )}
        {(note === "" || note === undefined || editNote) && (
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(e) => e.key === "Enter" && handleEnterDown()}
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
