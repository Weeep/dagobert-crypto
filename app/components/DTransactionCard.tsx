import React, { useEffect, useState } from "react";
import { TransactionIf } from "./Interfaces";
import { DagobertTransaction } from "@/utils/types";

interface Props {
  transaction: TransactionIf;
  onClick: (transaction: DagobertTransaction, remove: boolean) => void;
}

const DTransactionCard: React.FC<Props> = ({ transaction, onClick }) => {
  const [isMarked, setIsMarked] = useState(false);
  const [cardValues, setCardValues] = useState<DagobertTransaction>({
    orderId: 0,
    pair: "",
    incomeUsd: 0,
    date: "",
    side: "",
    qty: 0,
    price: 0,
  });

  const calculateCardValues = (transaction: TransactionIf) => {
    /*
    pair: string; // SOLUSDC
    spentUsd: number; //8.03
    date: Date; //24. 12. 29.
    side: string; // SELL
    qty: number; // 0.041
    price: number; // 195.94
    */

    const cqq = p(transaction.cummulativeQuoteQty, 2);

    const cv: DagobertTransaction = {
      orderId: transaction.orderId,
      pair: transaction.symbol,
      incomeUsd: transaction.side === "SELL" ? cqq : 0 - cqq,
      date: formatDate(transaction.updateTime),
      side: transaction.side,
      qty: p(transaction.executedQty),
      price: p(
        getPrice(transaction.cummulativeQuoteQty, transaction.executedQty)
      ),
    };

    setCardValues(cv);
  };

  let useEffectFirst = true;
  useEffect(() => {
    if (useEffectFirst) {
      useEffectFirst = false;
      calculateCardValues(transaction);
    }
  }, []);

  const handleClick = () => {
    onClick(cardValues, !isMarked);
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
        {cardValues.pair}&nbsp;&nbsp;
        {cardValues.incomeUsd >= 0
          ? "+" + cardValues.incomeUsd
          : cardValues.incomeUsd}
        $&nbsp;&nbsp;{cardValues.qty}
      </h2>
      <p className="text-xs text-gray-500 mb-2">
        {cardValues.date}:{" "}
        <span
          className={`bg-${
            cardValues.side === "BUY" ? "green" : "red"
          }-100 p-1`}
        >
          {cardValues.side}
        </span>{" "}
        {/*<b>
          {cardValues.qty} {cardValues.pair.replace(/USDT$|USDC$/g, "")}
        </b>*/}
        {" on "}
        <b>${cardValues.price}</b>
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

export default DTransactionCard;
