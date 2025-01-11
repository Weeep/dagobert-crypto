import React, { useEffect, useState } from "react";
import {
  DagobertTransaction,
  DagobertTransactionGroup,
} from "@/utils/typesAndEnums";
import { formatDate } from "@/utils/helper";
import DtransactionGroups from "../lib/DtransactionGroups";

interface Props {
  epoch: number;
}

const DTransactionGroupContainer: React.FC<Props> = ({ epoch }) => {
  const [transactionGroups, setTransactionGroups] = useState<
    DagobertTransactionGroup[]
  >([]);
  const [profit, setProfit] = useState<number>(0);

  //let useEffectFirst = true;
  useEffect(() => {
    //if (useEffectFirst) {
    //  useEffectFirst = false;

    const fetchData = async () => {
      const response = DtransactionGroups.get(null);
      if (
        response.ok &&
        response.response &&
        response.response.groupedTransactions.length !== 0
      ) {
        const transactionGroupsTemp = response.response.groupedTransactions;
        let profitTemp = 0;
        for (const tg of transactionGroupsTemp) {
          profitTemp += tg.amount;
        }
        setProfit(profitTemp);
        setTransactionGroups(transactionGroupsTemp);
      } else {
        console.error("No transactionGroups by DtransactionGroups.get(null)");
      }
    };

    fetchData(); //await?
    //}
  }, [epoch]);

  return (
    <>
      <div className="text-2xl font-bold mb-4 mt-4">
        Grouped Transactions (profit: {profit.toFixed(2)}){" "}
        <span className="text-xs">{epoch}</span>
      </div>
      {transactionGroups.length !== 0 &&
        transactionGroups
          .sort((a, b) =>
            a.lastTransDateEpoch > b.lastTransDateEpoch ? -1 : 1
          )
          .map((transactionGroup) => (
            <div
              key={transactionGroup.groupId}
              className={`bg-${
                transactionGroup.amount <= 0 ? "red" : "green"
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
                    transactionGroup.amount >= 0 ? "lime" : "red"
                  }-500`}
                >
                  {transactionGroup.amount >= 0
                    ? "+" + transactionGroup.amount.toFixed(2)
                    : transactionGroup.amount.toFixed(2)}
                  $
                </span>
                &nbsp;&nbsp;{transactionGroup.executed.toFixed(2)}
              </h2>
              {transactionGroup.groupedTrans
                .sort((a, b) => (a.dateEpoch > b.dateEpoch ? -1 : 1))
                .map((t) => {
                  return (
                    <p key={t.orderId} className="text-xs text-gray-500 mb-2">
                      {formatDate(t.dateEpoch)}:{" "}
                      <span
                        className={`bg-${
                          t.side === "BUY" ? "green" : "red"
                        }-100 p-1`}
                      >
                        {t.side}
                      </span>
                      {" " + t.executed}
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
      className={`bg-${transactionGroup.amount <= 0 ? "red" : "green"}-100
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
            transactionGroup.amount >= 0 ? "lime" : "red"
          }-500`}
        >
          {transactionGroup.amount >= 0
            ? "+" + transactionGroup.amount.toFixed(2)
            : transactionGroup.amount.toFixed(2)}
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
