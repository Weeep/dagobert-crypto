import React, { useEffect, useState } from "react";
import {
  DagobertTransaction,
  DagobertTransactionGroup,
} from "@/utils/typesAndEnums";
import { formatDate, redCross } from "@/utils/helper";
import DtransactionGroups from "../lib/DtransactionGroups";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight } from "@fortawesome/free-solid-svg-icons";

interface Props {
  epoch: number;
}

type DtransactionGroupsInPairs = {
  pair: string;
  profitPair: number;
  lastEpoch: number;
  dtransactionGroups: DagobertTransactionGroup[];
};

const DTransactionGroupContainer: React.FC<Props> = ({ epoch }) => {
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

  let useEffectFirst = true;
  useEffect(() => {
    if (useEffectFirst) {
      useEffectFirst = false;
      initData();
    }
  }, [epoch]);

  const initData = () => {
    const transactionGroupsTemp = DtransactionGroups.getAll();
    if (transactionGroupsTemp && transactionGroupsTemp.length !== 0) {
      let prftTotal = 0;
      let dtGroupsInPairs: {
        [pair: string]: DtransactionGroupsInPairs;
      } = {};
      for (const tg of transactionGroupsTemp) {
        setIsPairOpen((prev) => {
          return { ...prev, [tg.pair]: { isOpen: false } };
        });
        prftTotal += tg.amount;
        if (!(tg.pair in dtGroupsInPairs)) {
          dtGroupsInPairs[tg.pair] = {
            pair: tg.pair,
            profitPair: tg.amount,
            lastEpoch: tg.lastTransDateEpoch,
            dtransactionGroups: [tg],
          };
        } else {
          dtGroupsInPairs[tg.pair].profitPair += tg.amount;
          dtGroupsInPairs[tg.pair].lastEpoch < tg.lastTransDateEpoch &&
            (dtGroupsInPairs[tg.pair].lastEpoch = tg.lastTransDateEpoch);
          dtGroupsInPairs[tg.pair].dtransactionGroups.push(tg);
        }
      }
      setProfitTotal(prftTotal);

      const sorted = Object.values(dtGroupsInPairs).sort((a, b) =>
        a.lastEpoch > b.lastEpoch ? -1 : 1
      );
      setDtransactionGroupsInPairs(sorted);
    } else {
      console.error("No transactionGroups by DtransactionGroups.getAll()");
    }
  };

  const deleteGroup = async (groupId: string) => {
    await DtransactionGroups.del(groupId);
    initData();
  };

  const pairGroupClicked = (pair: string) => {
    setIsPairOpen((prev) => {
      return { ...prev, [pair]: { isOpen: !prev[pair].isOpen } };
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
        <span className="hidden text-xs">{epoch}</span>
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
                    isPairOpen[dtgip.pair].isOpen ? "rotate-90" : "rotate-0"
                  }`}
                />{" "}
                {dtgip.pair} (profit: {dtgip.profitPair.toFixed(2)})
              </div>
              <div
                className={`${!isPairOpen[dtgip.pair].isOpen ? "hidden" : ""}`}
              >
                {dtgip.dtransactionGroups.map((dtg) => (
                  <div
                    key={dtg.groupId}
                    className={`bg-${dtg.amount <= 0 ? "red" : "green"}-100
       p-4 my-4 rounded-md shadow-md relative`}
                  >
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
                    <h2 className="text-xl font-semibold mb-2 text-black">
                      {dtgip.pair}&nbsp;&nbsp;
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
                      &nbsp;&nbsp;{dtg.executed.toFixed(2)}
                      &nbsp;&nbsp;{dtg.tradeType}
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
