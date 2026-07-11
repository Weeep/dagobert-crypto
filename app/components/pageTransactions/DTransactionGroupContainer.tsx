import React, { useEffect, useState } from "react";
import type { DagobertTransactionGroup } from "@/src/modules/transaction-group";
import {
  KvTransactionGroupRepository,
  ListTransactionGroupsUseCase,
} from "@/src/modules/transaction-group";
import { formatDate, getTradeTypeColor, redCross } from "@/utils/helper";
import DtransactionGroups from "../../lib/DtransactionGroups";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight } from "@fortawesome/free-solid-svg-icons";

const transactionGroupRepository = new KvTransactionGroupRepository();
const listTransactionGroupsUseCase = new ListTransactionGroupsUseCase(
  transactionGroupRepository
);

interface Props {
  newDtransactionGroupEpoch: number;
}

type DtransactionGroupsInPairs = {
  pair: string;
  profitPair: number;
  lastEpoch: number;
  dtransactionGroups: DagobertTransactionGroup[];
};

const DTransactionGroupContainer: React.FC<Props> = ({
  newDtransactionGroupEpoch,
}) => {
  const [profitTotal, setProfitTotal] = useState<number>(0);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isPairOpen, setIsPairOpen] = useState<{
    [pair: string]: {
      isOpen: boolean;
    };
  }>({});
  const [dtgips, setDtransactionGroupsInPairs] = useState<
    DtransactionGroupsInPairs[]
  >([]);

  useEffect(() => {
    initData();
  }, [newDtransactionGroupEpoch]);

  const initData = async () => {
    const transactionGroups = await listTransactionGroupsUseCase.execute();

    if (transactionGroups.length === 0) {
      setProfitTotal(0);
      setDtransactionGroupsInPairs([]);
      return;
    }

    let prftTotal = 0;
    const dtGroupsInPairs: {
      [pair: string]: DtransactionGroupsInPairs;
    } = {};

    for (const transactionGroup of transactionGroups) {
      setIsPairOpen((prev) => ({
        ...prev,
        [transactionGroup.pair]: prev[transactionGroup.pair] ?? {
          isOpen: false,
        },
      }));
      prftTotal += transactionGroup.amount;
      if (!(transactionGroup.pair in dtGroupsInPairs)) {
        dtGroupsInPairs[transactionGroup.pair] = {
          pair: transactionGroup.pair,
          profitPair: transactionGroup.amount,
          lastEpoch: transactionGroup.lastTransDateEpoch,
          dtransactionGroups: [transactionGroup],
        };
      } else {
        dtGroupsInPairs[transactionGroup.pair].profitPair +=
          transactionGroup.amount;
        dtGroupsInPairs[transactionGroup.pair].lastEpoch <
          transactionGroup.lastTransDateEpoch &&
          (dtGroupsInPairs[transactionGroup.pair].lastEpoch =
            transactionGroup.lastTransDateEpoch);
        dtGroupsInPairs[transactionGroup.pair].dtransactionGroups.push(
          transactionGroup
        );
      }
    }

    setProfitTotal(prftTotal);
    setDtransactionGroupsInPairs(Object.values(dtGroupsInPairs));
  };

  const deleteGroup = async (groupId: string) => {
    await DtransactionGroups.del(groupId);
    initData();
  };

  const pairGroupClicked = (pair: string) => {
    setIsPairOpen((prev) => {
      return { ...prev, [pair]: { isOpen: !prev[pair]?.isOpen } };
    });
  };

  return (
    <>
      <div
        className="cursor-pointer text-2xl font-bold mb-4 mt-4"
        onClick={() => setIsOpen(!isOpen)}
      >
        <FontAwesomeIcon
          icon={faChevronRight}
          className={`transform transition-transform duration-300 ${
            isOpen ? "rotate-90" : "rotate-0"
          }`}
        />{" "}
        Grouped Transactions (profit: {profitTotal.toFixed(2)}){" "}
        <span className="hidden text-xs">{newDtransactionGroupEpoch}</span>
      </div>
      <div className={`ml-8 ${!isOpen ? "hidden" : ""}`}>
        {dtgips.length !== 0 &&
          dtgips.map((dtgip) => (
            <div key={dtgip.pair + "_" + dtgip.lastEpoch}>
              <div
                className="text-xl cursor-pointer mb-2"
                onClick={() => pairGroupClicked(dtgip.pair)}
              >
                <FontAwesomeIcon
                  icon={faChevronRight}
                  className={`transform transition-transform duration-300 ${
                    isPairOpen[dtgip.pair]?.isOpen ? "rotate-90" : "rotate-0"
                  }`}
                />{" "}
                {dtgip.pair} (profit: {dtgip.profitPair.toFixed(2)})
              </div>
              <div
                className={`${!isPairOpen[dtgip.pair]?.isOpen ? "hidden" : ""}`}
              >
                {dtgip.dtransactionGroups
                  .sort((a, b) =>
                    a.lastTransDateEpoch > b.lastTransDateEpoch ? -1 : 1
                  )
                  .map((dtg) => (
                    <div
                      key={dtg.groupId}
                      className={`bg-${dtg.amount <= 0 ? "red" : "green"}-100
       p-4 my-4 rounded-md shadow-md relative`}
                    >
                      <div
                        className={`absolute top-2 bottom-2 left-1 w-1 ${getTradeTypeColor(
                          dtg.tradeType
                        )} rounded-full`}
                        title={`${dtg.tradeType} Order`}
                      ></div>
                      <button
                        className="absolute right-2 top-2 text-xs"
                        onClick={() => {
                          deleteGroup(dtg.groupId as string);
                        }}
                      >
                        {redCross}
                      </button>
                      <div style={{ display: "none" }}>
                        <span className="text-lime-600"></span>
                        <span className="text-red-500"></span>
                        <span className="bg-red-100"></span>
                        <span className="bg-green-100"></span>
                        <span className="bg-slate-100"></span>
                        <span className="bg-blue-100"></span>
                        TODO: It looks without these the below aggregation does
                        not work
                      </div>
                      <h2 className="text-xl flex space-x-3 font-semibold mb-2 text-black">
                        <span>{dtgip.pair}</span>
                        <span
                          className={`text-${
                            dtg.amount >= 0 ? "lime" : "red"
                          }-600`}
                        >
                          {dtg.amount >= 0
                            ? "+" + dtg.amount.toFixed(2)
                            : dtg.amount.toFixed(2)}
                          $
                        </span>
                        <span>
                          {dtg.executed !== 0 && dtg.executed.toFixed(2)}
                        </span>
                      </h2>
                      {dtg.groupedTrans
                        .sort((a, b) => (a.dateEpoch > b.dateEpoch ? -1 : 1))
                        .map((t) => {
                          return (
                            <p
                              key={t.orderId}
                              className="text-xs text-gray-500 mb-2"
                            >
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
              </div>
            </div>
          ))}
      </div>
    </>
  );
};

export default DTransactionGroupContainer;
