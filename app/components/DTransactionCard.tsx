import React, { useEffect, useState } from "react";
import { TransactionIf } from "./Interfaces";
import { DagobertTransaction } from "@/utils/typesAndEnums";
import { formatDate, getPrice, getTargetPrices } from "@/utils/helper";

interface Props {
  dtransaction: DagobertTransaction;
  onClick: (transaction: DagobertTransaction, remove: boolean) => void;
}

const DTransactionCard: React.FC<Props> = ({ dtransaction, onClick }) => {
  const [isMarked, setIsMarked] = useState(false);

  const toggleSelection = () => {
    onClick(dtransaction, !isMarked);
    setIsMarked(!isMarked);
    //setIsVisible(false);
  };

  return (
    <div
      onClick={toggleSelection}
      className={`bg-${
        isMarked ? "blue" : "slate"
      }-100 p-4 rounded-md shadow-md`}
    >
      <div style={{ display: "none" }}>
        <span className="bg-red-100"></span>
        <span className="bg-green-100"></span>
        <span className="bg-slate-100"></span>
        <span className="bg-blue-100"></span>
        TODO: It looks without these the below aggregation does not work
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
      <p className="text-xs text-center text-gray-400">
        {getTargetPrices(dtransaction.price, [-5, -3, 3, 5, 10]).map(
          (item, index) => (
            <span key={index}>| {item} |</span>
          )
        )}
      </p>

      {/*<div className="text-black">
        {dtransaction.dateEpoch}|||
        {getDate(dtransaction.dateEpoch)}
      </div>*/}
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
