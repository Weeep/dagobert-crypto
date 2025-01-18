import { useState, useEffect } from "react";
import { SymbolPriceIf } from "../lib/Interfaces";
import DTransactionCardContainer from "./DTransactionCardContainer";
import PairsAndPrices from "./PairsAndPrices";
import DTransactionGroupContainer from "./DTransactionGroupContainer";
import { DagobertTransaction, KVRoot } from "@/utils/typesAndEnums";
import ClientSideDbCache from "../lib/ClientSideDbCache";
import { convertArrayToObject, redCross } from "@/utils/helper";
import Dtransactions from "../lib/Dtransactions";

const PageTransactions = () => {
  const [dtransactions, setDtransactions] = useState<DagobertTransaction[]>([]);
  const [numOfTransactions, setnumOfTransactions] = useState<number>(0);
  const [dTransGroupContainer, setDtransGroupContainer] =
    useState<React.ReactNode>(
      <DTransactionGroupContainer epoch={Date.now()} />
    );
  const [pairPricesObj, setPairPrices] = useState<{
    [key: string]: {
      price: number;
      numOfTransactions: number;
    };
  }>({}); //TODO move symbolPrices to PairsAndPrices and rename it to pair
  const [selectedPairs, setSelectedPairs] = useState<string[]>([]);
  const [progressInfo, setProgressInfo] = useState<string>("");

  useEffect(() => {
    fetchTransactionData();
  }, []);

  const fetchTransactionData = async () => {
    const data = ClientSideDbCache.hgetall(KVRoot.dtransactions); //await fetchh(`/api/dbapi/dtransactions`); //transactions?status=FILLED`);
    let isTransactions: boolean = data;
    let filteredTransactions: DagobertTransaction[] = [];

    if (isTransactions) {
      const dtransactions = Object.values(data) as DagobertTransaction[];
      filteredTransactions = dtransactions.filter(
        (obj) => obj && obj.status === "FILLED" && !obj.grouped
      );

      isTransactions = filteredTransactions.length > 0;
    }

    if (isTransactions) {
      filteredTransactions.sort((a, b) => b.dateEpoch - a.dateEpoch);
      setDtransactions(filteredTransactions);
      setnumOfTransactions(filteredTransactions.length);
    } else {
      setProgressInfo(
        "No transaction in the database, fetch them by pressing Refresh (via binance api)."
      );
    }
  };

  return (
    <div className="mx-auto">
      <div>{progressInfo}</div>

      <PairsAndPrices
        pairsPricesCallback={setPairPrices}
        selectedPairs={selectedPairs}
        selectedPairsCallback={setSelectedPairs}
      />

      <DTransactionCardContainer
        dtransactions={dtransactions}
        pairsAndPrices={pairPricesObj}
        numOfTransactions={numOfTransactions}
        selectedPairs={selectedPairs}
        setDtransGroupContainer={setDtransGroupContainer}
      />

      {dTransGroupContainer}
    </div>
  );
};

export default PageTransactions;
