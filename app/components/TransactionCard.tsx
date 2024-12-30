import React, { useState } from "react";
import { TransactionIf } from "./Interfaces";

interface Props {
  transaction: TransactionIf;
  onClick: (transaction: TransactionIf, remove: boolean) => void;
}

/*
const TransactionCard2: React.FC<Props> = ({ transaction }) => {
  return (
    <div className={"bg-slate-50 p-4 rounded-md shadow-md"}>
      <h2 className="text-xl font-semibold mb-2 text-black">
        {transaction.symbol} - ${p(transaction.cummulativeQuoteQty, 2)}
      </h2>
      <p className="text-sm text-gray-600 mb-2">
        {p(transaction.executedQty)} (
        {p(getPrice(transaction.cummulativeQuoteQty, transaction.executedQty))})
      </p>
      <p className="text-xs text-gray-500 mb-2">
        {transaction.type.toLowerCase()} - {formatDate(transaction.updateTime)}
      </p>
      <p
        className={`text-xs bg-${
          transaction.side === "BUY" ? "green" : "red"
        }-100 p-1`}
      >
        {transaction.side}
      </p>
      <p className={`text-xs bg-green-100 p-1`}>{transaction.side}</p>
    </div>
  );
};
*/

const TransactionCard: React.FC<Props> = ({ transaction, onClick }) => {
  const [isMarked, setIsMarked] = useState(false);

  const handleClick = () => {
    //console.log(transaction.orderId);
    onClick(transaction, !isMarked);
    setIsMarked(!isMarked);
    //setIsVisible(false);
  };

  //
  return (
    <div
      onClick={handleClick}
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
      <h2 className="text-xl font-semibold mb-2 text-black">
        {transaction.symbol} - ${p(transaction.cummulativeQuoteQty, 2)}
      </h2>
      <p className="text-xs text-gray-500 mb-2">
        {formatDate(transaction.updateTime)}:{" "}
        <span
          className={`bg-${
            transaction.side === "BUY" ? "green" : "red"
          }-100 p-1`}
        >
          {transaction.side}
        </span>{" "}
        <b>
          {p(transaction.executedQty)} {transaction.symbol.replace("USDT", "")}
        </b>
        {" on "}
        <b>
          $
          {p(
            getPrice(transaction.cummulativeQuoteQty, transaction.executedQty)
          )}
        </b>
      </p>
      <p className="text-xs text-gray-500 mb-2">
        {getTargetPrices(
          getPrice(transaction.cummulativeQuoteQty, transaction.executedQty),
          [-5, -3, 3, 5, 10]
        ).map((item) => (
          <span key={transaction.orderId + item}>| {item} |</span>
        ))}
      </p>
    </div>
  );
};

function p(strNum: any, fixedTo: number = 0, multiplier: number = 1) {
  const num = parseFloat(strNum as unknown as string);
  let fixed = fixedTo;
  if (fixed == 0) {
    fixed = 3;
    if (num <= 1) fixed = 4;
    if (num <= 0.0001) fixed = 8;

    if (num >= 10) fixed = 2;
    if (num >= 100) fixed = 2; //1
    if (num >= 1000) fixed = 2; //0
    if (num >= 10000) fixed = 0;
  }

  return parseFloat((num * multiplier).toFixed(fixed));
}

function getTargetPrices(initialNumber: number, targets: number[]) {
  return targets.map((target) => {
    return p(
      parseFloat(((initialNumber * (100 + target)) / 100) as unknown as string)
    );
  });
}

function getPrice(cummulativeQuoteQty: string, executedQty: string) {
  return (executedQty as unknown as number) != 0
    ? (cummulativeQuoteQty as unknown as number) /
        (executedQty as unknown as number)
    : 0;
}

function formatDate(epoch: number) {
  const date = new Date(epoch);
  return new Intl.DateTimeFormat("hu-HU", {
    year: "2-digit", //numeric
    month: "2-digit",
    day: "2-digit",
    /*hour: "2-digit",
    minute: "2-digit",*/
    hour12: false, // Use 24-hour format
  }).format(date);
}

export default TransactionCard;
