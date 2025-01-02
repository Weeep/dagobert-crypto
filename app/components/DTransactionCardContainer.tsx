import React, { useState } from "react";
import { TransactionIf } from "./Interfaces";
import DTransactionCard from "./DTransactionCard";
import { DagobertTransaction, TransactionGroup } from "@/utils/types";

interface Props {
  transactions: TransactionIf[];
  numOfTransactions: number;
  selectedPairs: string[];
}

const DTransactionCardContainer: React.FC<Props> = ({
  transactions,
  numOfTransactions,
  selectedPairs,
}) => {
  const [markedForMerge, setMarkedForMerge] = useState<DagobertTransaction[]>(
    []
  );
  //const [mergedTransactions, setMergedTransactions] = useState<React.ReactNode>(
  //  <></>
  //);

  const handleTransactionMarked = (
    transaction: DagobertTransaction,
    add: boolean
  ) => {
    let newMarkedForMerge: DagobertTransaction[] = [];
    if (add) {
      newMarkedForMerge = [...markedForMerge, transaction];
    } else {
      newMarkedForMerge = markedForMerge.filter(function (item) {
        return item !== transaction;
      });
    }
    setMarkedForMerge(newMarkedForMerge);
  };

  const merge = async () => {
    let transactionGroup: TransactionGroup = {
      groupId: null,
      pair: "",
      incomeUsd: 0,
      qty: 0,
      lastTransDateStr: "",
      groupedTrans: [],
    };

    for (const dTrans of markedForMerge) {
      transactionGroup.pair = dTrans.pair; //TODO same pair validation, AVAX and SOL cannot be grouped
      transactionGroup.incomeUsd += dTrans.incomeUsd;
      transactionGroup.qty =
        dTrans.side === "BUY"
          ? transactionGroup.qty + dTrans.qty
          : transactionGroup.qty - dTrans.qty;
      transactionGroup.lastTransDateStr =
        transactionGroup.lastTransDateStr === ""
          ? dTrans.date
          : dTrans.date > transactionGroup.lastTransDateStr
          ? dTrans.date
          : transactionGroup.lastTransDateStr;
      transactionGroup.groupedTrans.push({
        orderId: dTrans.orderId,
        dateStr: dTrans.date,
        side: dTrans.side,
        price: dTrans.price,
        qty: dTrans.qty,
      });
    }

    try {
      const dbResponse = await fetch("/api/dbapi/transactionGroups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: [transactionGroup] }),
      });

      if (!dbResponse.ok) {
        throw dbResponse.status;
      } else {
        //setOrdersUpdateInfo(`Database update done.`);
      }
    } catch (error) {
      console.error(`Error storing transactionGroup`, error);
    }

    /*
    setMergedTransactions(
      <div
        className={`bg-${transactionGroup.incomeUsd <= 0 ? "red" : "green"}-100
       p-4 rounded-md shadow-md`}
      >
        <div style={{ display: "none" }}>
          <span className="bg-red-100"></span>
          <span className="bg-green-100"></span>
          <span className="bg-slate-100"></span>
          <span className="bg-blue-100"></span>
          TODO: It looks without these the below aggregation does not work
        </div>
        <h2 className="text-xl font-semibold mb-2 text-black">
          {transactionGroup.pair}&nbsp;&nbsp;
          <span
            className={`text-${
              transactionGroup.incomeUsd >= 0 ? "lime" : "red"
            }-500`}
          >
            {transactionGroup.incomeUsd >= 0
              ? "+" + transactionGroup.incomeUsd.toFixed(2)
              : transactionGroup.incomeUsd.toFixed(2)}
            $
          </span>
          &nbsp;&nbsp;{transactionGroup.qty}
        </h2>
        {transactionGroup.groupedTrans.map((t) => {
          return (
            <p key={t.orderId} className="text-xs text-gray-500 mb-2">
              {t.orderId}:{" "}
              <span
                className={`bg-${t.side === "BUY" ? "green" : "red"}-100 p-1`}
              >
                {t.side}
              </span>{" "}
              {" on "}
              <b>${t.price}</b>
            </p>
          );
        })}
      </div>
    ); */
  };

  const filteredData = transactions.filter((t: TransactionIf) => {
    return selectedPairs.length === 0 || selectedPairs.includes(t.symbol);
  });

  return (
    <>
      {/* p-8">*/}
      <h1 className="text-2xl font-bold mb-4 mt-4">
        Transactions ({numOfTransactions})
      </h1>
      {markedForMerge.length > 1 ? (
        <div className="relative">
          <button
            onClick={merge}
            className="fixed bottom-0 left-20 right-20 m-10 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full focus:outline-none focus:shadow-outline-blue active:bg-blue-800"
          >
            Merge
          </button>
          {/*<div>{mergedTransactions}</div>*/}
        </div>
      ) : (
        ""
      )}
      <div
        id="cont"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {filteredData.length !== 0 &&
          filteredData.map((transaction) => (
            <DTransactionCard
              key={transaction.orderId}
              transaction={transaction}
              onClick={handleTransactionMarked}
            />
          ))}
      </div>
    </>
  );
};

export default DTransactionCardContainer;
