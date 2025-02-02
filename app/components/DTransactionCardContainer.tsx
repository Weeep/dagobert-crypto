import React, { useState } from "react";
import DTransactionCard from "./DTransactionCard";
import {
  DagobertTransaction,
  DagobertTransactionGroup,
  TradeStyle,
  TradeType,
} from "@/utils/typesAndEnums";
import DtransactionGroups from "../lib/DtransactionGroups";
import DTransactionGroupContainer from "./DTransactionGroupContainer";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronRight,
  faObjectGroup,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import Dtransactions from "../lib/Dtransactions";

interface Props {
  dtransactions: DagobertTransaction[];
  pairsAndPrices: {
    [key: string]: { price: number; numOfTransactions: number };
  };
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
  pairsAndPrices,
  numOfTransactions,
  selectedPairs,
  setDtransGroupContainer,
}) => {
  const [markedForMerge, setMarkedForMerge] = useState<MarkedDTransaction[]>(
    []
  );
  const [markedForTrash, setMarkedForTrash] = useState<MarkedDTransaction[]>(
    []
  );
  const [isOpen, setIsOpen] = useState<boolean>(true);

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
    setMarkedForTrash(newMarkedForMerge);
  };

  const mergeCalculation = (
    handleVisibility: boolean = false
  ): DagobertTransactionGroup => {
    let transactionGroup: DagobertTransactionGroup = {
      groupId: null,
      pair: "",
      tradeType: TradeType.Spot,
      amount: 0,
      executed: 0,
      lastTransDateEpoch: 0,
      groupedTrans: [],
      note: "",
    };

    for (const mDTrans of markedForMerge) {
      const dTrans = mDTrans.dtransaction;

      transactionGroup.pair = dTrans.pair; //TODO same pair WARNING validation needed, AVAX and SOL cannot be grouped
      transactionGroup.tradeType = dTrans.tradeType; //TODO same tradeType ERROR validation needed
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

      if (handleVisibility) {
        mDTrans.visibilityFunc(false);
      }
    }

    return transactionGroup;
  };

  const trash = () => {
    for (const mdt of markedForTrash) {
      Dtransactions.setStyleProperty(
        mdt.dtransaction.orderId,
        TradeStyle.Trash
      );
    }
  };

  const merge = async () => {
    let transactionGroup: DagobertTransactionGroup = mergeCalculation(true);

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

  const getCurPrice = (pair: string): number => {
    if (pair in pairsAndPrices) {
      return pairsAndPrices[pair].price;
    } else {
      return 100; // TODO, he nincs 100 sehol, pedig exceptiont dobott ha nem csekkolom
    }
  };

  const mergePreview = (): React.ReactElement => {
    const transactionGroup = mergeCalculation();
    let r: React.ReactElement = <></>;
    if (transactionGroup.groupedTrans.length > 1) {
      r = (
        <>
          {transactionGroup.amount.toFixed(2)}
          {"$ "}
          {transactionGroup.executed.toFixed(3)} {transactionGroup.pair}
        </>
      );
    }
    return r;
  };

  const drawActionPanel = (): React.ReactElement => {
    if (markedForMerge.length == 0) return <></>;

    const buttonCss =
      "cursor-pointer bg-white hover:bg-blue-700 hover:text-white rounded-full text-blue-500 text-center flex items-center font-bold p-3 w-10 h-10";

    //"bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full focus:outline-none focus:shadow-outline-blue active:bg-blue-800"

    const trashButton: React.ReactElement | null =
      markedForMerge.length > 0 ? (
        <button onClick={trash} className={buttonCss} title="Trash">
          <FontAwesomeIcon icon={faTrash} />
        </button>
      ) : null;
    const mergeButton: React.ReactElement | null =
      markedForMerge.length > 1 ? (
        <button onClick={merge} className={buttonCss} title="Merge">
          <FontAwesomeIcon icon={faObjectGroup} />
        </button>
      ) : null;

    return (
      <div className="z-50 fixed bottom-2 left-1/2 -translate-x-1/2 p-5 bg-blue-500 rounded">
        <div
          id="buttons"
          className="flex flex-row space-x-2 mb-2 items-center justify-center"
        >
          {trashButton}
          {mergeButton}
        </div>
        {mergeButton && (
          <div className="bg-white text-black rounded px-5" id="preview">
            {markedForMerge.length > 1 && mergePreview()}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative">
      {/* p-8">*/}
      <h1
        className="cursor-pointer text-2xl font-bold mb-4 mt-4"
        onClick={() => setIsOpen(!isOpen)}
      >
        <FontAwesomeIcon
          icon={faChevronRight}
          className={`transform transition-transform duration-300 ${
            isOpen ? "rotate-90" : "rotate-0"
          }`}
        />{" "}
        Transactions ({numOfTransactions})
      </h1>

      {drawActionPanel()}

      <div
        id="cont"
        className={`${
          !isOpen ? "hidden" : ""
        } grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`}
      >
        {filteredData.length !== 0 &&
          filteredData.map((transaction, index) => (
            <DTransactionCard
              key={transaction.orderId + "." + index}
              dtransaction={transaction}
              currentPrice={getCurPrice(transaction.pair)}
              onClick={handleTransactionMarked}
            />
          ))}
      </div>
    </div>
  );
};

export default DTransactionCardContainer;
