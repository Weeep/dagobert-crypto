import React, { useState } from "react";
import DTransactionCard from "./DTransactionCard";
import {
  DagobertTransaction,
  DagobertTransactionGroup,
} from "@/utils/typesAndEnums";
import DtransactionGroups from "../lib/DtransactionGroups";
import DTransactionGroupContainer from "./DTransactionGroupContainer";

interface Props {
  dtransactions: DagobertTransaction[];
  numOfTransactions: number;
  selectedPairs: string[];
  setDtransGroupContainer: (dtransGroupContainer: React.ReactNode) => void;
}

type MarkedDTransaction = {
  dtransaction: DagobertTransaction;
  visibilityFunc: (isVisible: boolean) => void;
};

const DTransactionCardContainer: React.FC<Props> = ({
  dtransactions,
  numOfTransactions,
  selectedPairs,
  setDtransGroupContainer,
}) => {
  const [markedForMerge, setMarkedForMerge] = useState<MarkedDTransaction[]>(
    []
  );
  //const [mergedTransactions, setMergedTransactions] = useState<React.ReactNode>(
  //  <></>
  //);

  const handleTransactionMarked = (
    dtransaction: DagobertTransaction,
    add: boolean,
    handleVisibility: (isVisible: boolean) => void
  ) => {
    let newMarkedForMerge: MarkedDTransaction[] = []; // = //markedForMerge; //
    if (add) {
      //newMarkedForMerge.push({
      //  dtransaction,
      //  visibilityFunc: handleVisibility,
      //});
      newMarkedForMerge = [
        ...markedForMerge,
        { dtransaction, visibilityFunc: handleVisibility },
      ];
    } else {
      newMarkedForMerge = markedForMerge.filter(function (item) {
        return item.dtransaction.orderId !== dtransaction.orderId;
      });
    }
    setMarkedForMerge(newMarkedForMerge);
  };

  const merge = async () => {
    let transactionGroup: DagobertTransactionGroup = {
      groupId: null,
      pair: "",
      amount: 0,
      executed: 0,
      lastTransDateEpoch: 0,
      groupedTrans: [],
    };

    for (const mDTrans of markedForMerge) {
      const dTrans = mDTrans.dtransaction;

      transactionGroup.pair = dTrans.pair; //TODO same pair validation, AVAX and SOL cannot be grouped
      transactionGroup.amount += dTrans.amount;
      transactionGroup.executed =
        dTrans.side === "BUY"
          ? transactionGroup.executed + dTrans.executed
          : transactionGroup.executed - dTrans.executed;
      transactionGroup.lastTransDateEpoch =
        transactionGroup.lastTransDateEpoch === 0
          ? dTrans.dateEpoch
          : dTrans.dateEpoch > transactionGroup.lastTransDateEpoch
          ? dTrans.dateEpoch
          : transactionGroup.lastTransDateEpoch;
      transactionGroup.groupedTrans.push(dTrans);

      mDTrans.visibilityFunc(false);
    }

    if (transactionGroup.groupedTrans.length > 1) {
      try {
        const r = await DtransactionGroups.post([transactionGroup]);
        setDtransGroupContainer(
          <DTransactionGroupContainer epoch={Date.now()} />
        );
        setMarkedForMerge([]);
      } catch (error) {
        console.error("Error storing transactionGroup", error);
      }
    }
  };

  const filteredData = dtransactions.filter((dt: DagobertTransaction) => {
    return selectedPairs.length === 0 || selectedPairs.includes(dt.pair);
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
          filteredData.map((transaction, index) => (
            <DTransactionCard
              key={index}
              dtransaction={transaction}
              onClick={handleTransactionMarked}
            />
          ))}
      </div>
    </>
  );
};

export default DTransactionCardContainer;
