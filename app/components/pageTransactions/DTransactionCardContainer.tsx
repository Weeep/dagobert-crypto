import React, { useEffect, useState } from "react";
import DTransactionCard from "./DTransactionCard";
import {
  DagobertTransaction,
  DagobertTransactionGroup,
  KVRoot,
  TradeStyle,
  TradeType,
} from "@/utils/typesAndEnums";
import DtransactionGroups from "../../lib/DtransactionGroups";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronRight,
  faObjectGroup,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import Dtransactions from "../../lib/Dtransactions";
import ClientSideDbCache from "../../lib/ClientSideDbCache";

interface Props {
  //dtransactions: DagobertTransaction[];
  selectedPairsProp: string[];
  pairsAndPrices: {
    [key: string]: { price: number; numOfTransactions: number };
  };
  //numOfTransactions: number;
  //selectedPairs: string[];
  //setDtransGroupContainer: (dtransGroupContainer: React.ReactNode) => void;
  newDtransactionGroupEpochCallback: (dTransactionGroupEpoch: number) => void;
}

//type MarkedDTransaction = {
//  dtransaction: DagobertTransaction;
//  visibilityFunc: (isVisible: boolean) => void;
//};

const DTransactionCardContainer: React.FC<Props> = ({
  //dtransactions,
  selectedPairsProp,
  pairsAndPrices,
  //numOfTransactions,
  //selectedPairs,
  //setDtransGroupContainer,
  newDtransactionGroupEpochCallback,
}) => {
  const [dtransactions, setDtransactions] = useState<DagobertTransaction[]>([]);
  const [selectedPairs, setSelectedPairs] = useState<string[]>([]);
  const [markedForMerge, setMarkedForMerge] = useState<DagobertTransaction[]>(
    []
  );
  const [markedForTrash, setMarkedForTrash] = useState<DagobertTransaction[]>(
    []
  );
  const [isOpen, setIsOpen] = useState<boolean>(true);

  useEffect(() => {
    setMarkedForMerge([]);
    fetchDtransactions();
  }, [selectedPairs]);

  useEffect(() => {
    setSelectedPairs(selectedPairsProp);
  }, [selectedPairsProp]);

  const fetchDtransactions = () => {
    const data = ClientSideDbCache.hgetall(KVRoot.dtransactions);
    let isTransactions: boolean = data;
    let filteredTransactions: DagobertTransaction[] = [];

    if (isTransactions) {
      const dtransactions = Object.values(data) as DagobertTransaction[];
      filteredTransactions = dtransactions.filter(
        (obj) =>
          obj &&
          obj.status === "FILLED" &&
          !obj.grouped &&
          obj.tradeStyle === TradeStyle.Swing
      );

      filteredTransactions = filteredTransactions.filter(
        (dt: DagobertTransaction) => {
          return selectedPairs.length === 0 || selectedPairs.includes(dt.pair);
        }
      );

      isTransactions = filteredTransactions.length > 0;
    }

    if (isTransactions) {
      filteredTransactions.sort((a, b) => b.dateEpoch - a.dateEpoch);
      setDtransactions(filteredTransactions);
    }
  };

  const handleCardClicked = (dtransaction: DagobertTransaction) => {
    let newMarkedForMerge: DagobertTransaction[] = [];

    const add = !markedForMerge.some(
      (mdtrans) => mdtrans.orderId === dtransaction.orderId
    );

    if (add) {
      newMarkedForMerge = [...markedForMerge, dtransaction];
    } else {
      newMarkedForMerge = markedForMerge.filter(function (item) {
        return item.orderId !== dtransaction.orderId;
      });
    }

    setMarkedForMerge(newMarkedForMerge);
    setMarkedForTrash(newMarkedForMerge);
  };

  const handlePairOnCardClicked = (pair: string) => {
    if (selectedPairs.length !== 1) {
      setSelectedPairs([pair]); //(prev) => [...prev, pair]);
    } else {
      setSelectedPairs([]); //(prev) => prev.filter((p) => p !== pair));
    }
  };

  const trash = () => {
    for (const dt of markedForTrash) {
      Dtransactions.setStyleProperty(dt.orderId, TradeStyle.Trash);
    }
  };

  const mergePreview = (): React.ReactElement => {
    const dtransactionGroup: DagobertTransactionGroup =
      DtransactionGroups.group(markedForMerge);
    let r: React.ReactElement = <></>;
    if (dtransactionGroup.groupedTrans.length > 1) {
      r = (
        <>
          {dtransactionGroup.amount.toFixed(2)}
          {"$ "}
          {dtransactionGroup.executed.toFixed(3)} {dtransactionGroup.pair}
        </>
      );
    }
    return r;
  };

  const merge = async () => {
    let dtransactionGroup: DagobertTransactionGroup =
      DtransactionGroups.group(markedForMerge);

    if (dtransactionGroup.groupedTrans.length > 1) {
      try {
        const r = await DtransactionGroups.post([dtransactionGroup]);
        if (r.ok) {
          newDtransactionGroupEpochCallback(new Date().getTime());
        } else {
          throw new Error(JSON.stringify(r));
        }
        setMarkedForMerge([]);
        fetchDtransactions();
      } catch (error) {
        console.error("Error storing transactionGroup", error); //TODO
      }
    }
  };

  const getCurPrice = (pair: string): number => {
    if (pair in pairsAndPrices) {
      return pairsAndPrices[pair].price;
    } else {
      return 100; // TODO, he nincs 100 sehol, pedig exceptiont dobott ha nem csekkolom
    }
  };

  const drawActionPanel = (): React.ReactElement => {
    if (markedForMerge.length == 0) return <></>;

    const buttonCss =
      "cursor-pointer bg-white hover:bg-blue-700 hover:text-white rounded-full text-blue-500 text-center flex items-center font-bold p-3 w-10 h-10";

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
        Transactions ({dtransactions.length})
      </h1>

      {drawActionPanel()}

      {dtransactions.length === 0 && (
        <div>
          No transaction in the database, fetch them by pressing Refresh (via
          binance api).
        </div>
      )}

      <div
        id="cont"
        className={`${
          !isOpen ? "hidden" : ""
        } grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`}
      >
        {dtransactions.length !== 0 &&
          dtransactions.map((transaction, index) => (
            <DTransactionCard
              key={transaction.orderId + "." + index}
              dtransaction={transaction}
              currentPrice={getCurPrice(transaction.pair)}
              clickOnCard={handleCardClicked}
              clickOnPair={handlePairOnCardClicked}
            />
          ))}
      </div>
    </div>
  );
};

export default DTransactionCardContainer;
