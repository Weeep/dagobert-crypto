import React, { useEffect, useState } from "react";
import { TransactionIf } from "./Interfaces";
import { DagobertTransaction } from "@/utils/types";
import { formatDate, getPrice, getTargetPrices } from "@/utils/helper";

interface Props {
  dtransaction: DagobertTransaction;
  onClick: (transaction: DagobertTransaction, remove: boolean) => void;
}

const DTransactionCard: React.FC<Props> = ({ dtransaction, onClick }) => {
  const [isMarked, setIsMarked] = useState(false);
  // const [dtransaction, setdtransaction] = useState<DagobertTransaction>({
  //   orderId: "",
  //   pair: "",
  //   amount: 0,
  //   dateEpoch: 0,
  //   date: new Date(),
  //   side: "",
  //   executed: 0,
  //   price: 0,
  //   grouped: false,
  // });

  const calculatedtransaction = (transaction: TransactionIf) => {
    /*
    pair: string; // SOLUSDC
    spentUsd: number; //8.03
    date: Date; //24. 12. 29.
    side: string; // SELL
    qty: number; // 0.041
    price: number; // 195.94
    */
    // const cqq = stringToRoundedFloat(transaction.cummulativeQuoteQty, 2);
    // const cv: DagobertTransaction = {
    //   orderId: transaction.orderId.toString(),
    //   pair: transaction.symbol,
    //   amount: transaction.side === "SELL" ? cqq : 0 - cqq,
    //   dateEpoch: transaction.updateTime,
    //   date: new Date(transaction.updateTime),
    //   side: transaction.side,
    //   executed: stringToRoundedFloat(transaction.executedQty),
    //   price: stringToRoundedFloat(
    //     getPrice(transaction.cummulativeQuoteQty, transaction.executedQty)
    //   ),
    //   grouped: false,
    // };
    //setdtransaction(cv);
  };

  // let useEffectFirst = true;
  // useEffect(() => {
  //   if (useEffectFirst) {
  //     useEffectFirst = false;
  //     calculatedtransaction(transaction);
  //   }
  // }, []);

  const handleClick = () => {
    onClick(dtransaction, !isMarked);
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

      {/* Row 1 */}
      <div className="flex justify-center font-semibold mb-2 text-black">
        {[
          ["Pair", dtransaction.pair],
          [
            "Amount",
            (dtransaction.amount >= 0
              ? "+" + dtransaction.amount
              : dtransaction.amount
            ).toString(),
          ],
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
          ["Price", dtransaction.price.toString()],
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
        {getTargetPrices(dtransaction.price, [-5, -3, 3, 5, 10]).map((item) => (
          <span key={dtransaction.orderId + item}>| {item} |</span>
        ))}
      </p>
    </div>
  );
};

//function formatDate(epoch: number): string {
//
//}

export default DTransactionCard;
