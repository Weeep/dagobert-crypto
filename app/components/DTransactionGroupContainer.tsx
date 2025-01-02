import React, { useEffect, useState } from "react";
import { TransactionIf } from "./Interfaces";
import DTransactionCard from "./DTransactionCard";
import { DagobertTransaction, TransactionGroup } from "@/utils/types";

const DTransactionGroupContainer: React.FC = () => {
  const [transactionGroups, setTransactionGroups] = useState<
    TransactionGroup[]
  >([]);
  const [profit, setProfit] = useState<number>(0);

  let useEffectFirst = true;
  useEffect(() => {
    if (useEffectFirst) {
      useEffectFirst = false;

      const fetchData = async () => {
        let transactionGroupsTemp: TransactionGroup[] = [];

        try {
          const dbResponse = await fetch("/api/dbapi/transactionGroups");

          if (!dbResponse.ok) {
            throw dbResponse.status;
          } else {
            //setTransactionGroups(
            transactionGroupsTemp =
              (await dbResponse.json()) as TransactionGroup[];
            //);
          }
        } catch (error) {
          console.error(`Error storing transactionGroup`, error);
        }

        if (transactionGroupsTemp.length !== 0) {
          let profitTemp = 0;
          for (const tg of transactionGroupsTemp) {
            profitTemp += tg.incomeUsd;
          }
          setProfit(profitTemp);
          setTransactionGroups(transactionGroupsTemp);
        }
      };

      fetchData();
    }
  }, []);

  return (
    <>
      <div className="text-2xl font-bold mb-4 mt-4">
        Grouped Transactions (profit: {profit.toFixed(2)})
      </div>
      {transactionGroups.length !== 0 &&
        transactionGroups
          .sort((a, b) => (a.lastTransDateStr > b.lastTransDateStr ? -1 : 1))
          .map((transactionGroup) => (
            <div
              key={transactionGroup.groupId}
              className={`bg-${
                transactionGroup.incomeUsd <= 0 ? "red" : "green"
              }-100
       p-4 my-4 rounded-md shadow-md`}
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
                &nbsp;&nbsp;{transactionGroup.qty.toFixed(2)}
              </h2>
              {transactionGroup.groupedTrans
                .sort((a, b) => (a.dateStr > b.dateStr ? -1 : 1))
                .map((t) => {
                  return (
                    <p key={t.orderId} className="text-xs text-gray-500 mb-2">
                      {t.dateStr}:{" "}
                      <span
                        className={`bg-${
                          t.side === "BUY" ? "green" : "red"
                        }-100 p-1`}
                      >
                        {t.side}
                      </span>
                      {" " + t.qty}
                      {" on "}
                      <b>${t.price}</b>
                    </p>
                  );
                })}
            </div>
          ))}
    </>
  );

  /*
    {transactionGroups.length !== 0 &&
      transactionGroups.map((transactionGroup) => (
    
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
    </div>)}
  );*/
};

export default DTransactionGroupContainer;
