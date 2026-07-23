import React, { useEffect, useState } from "react";
import DTransactionCard from "./DTransactionCard";
import type { DagobertTransaction } from "@/src/modules/transaction";
import { TradeStyle } from "@/src/modules/transaction";
import type { DagobertTransactionGroup } from "@/src/modules/transaction-group";
import { DtransactionGroups } from "@/src/modules/transaction-group";
import { clientUseCasesSingleton } from "@/src/shared/application/clientUseCasesSingleton";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronRight,
  faObjectGroup,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";

const listOpenTransactionsUseCase = clientUseCasesSingleton.listOpenTransactions;
const updateTransactionTradeStyleUseCase =
  clientUseCasesSingleton.updateTransactionTradeStyle;

interface Props {
  selectedPairsProp: string[];
  pairsAndPrices: {
    [key: string]: { price: number; numOfTransactions: number };
  };
  newDtransactionGroupEpochCallback: (dTransactionGroupEpoch: number) => void;
}

const DTransactionCardContainer: React.FC<Props> = ({
  selectedPairsProp,
  pairsAndPrices,
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

  const fetchDtransactions = async () => {
    const openTransactions = await listOpenTransactionsUseCase.execute({
      tradeStyle: TradeStyle.Swing,
    });
    const filteredTransactions = openTransactions.filter(
      (transaction) =>
        selectedPairs.length === 0 || selectedPairs.includes(transaction.pair)
    );

    setDtransactions(filteredTransactions);
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
      setSelectedPairs([pair]);
    } else {
      setSelectedPairs([]);
    }
  };

  const trash = async () => {
    await Promise.all(
      markedForTrash.map((transaction) =>
        updateTransactionTradeStyleUseCase.execute(
          transaction.orderId,
          TradeStyle.Trash
        )
      )
    );
    setMarkedForMerge([]);
    setMarkedForTrash([]);
    await fetchDtransactions();
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
