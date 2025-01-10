import { useState, useEffect } from "react";
import { TransactionIf, SymbolPriceIf } from "./Interfaces";
import DTransactionCardContainer from "./DTransactionCardContainer";
import ProgressInfo from "./ProgressInfo";
import PairsAndPrices from "./PairsAndPrices";
import DTransactionGroupContainer from "./DTransactionGroupContainer";
import { DagobertTransaction, KVRoot } from "@/utils/typesAndEnums";
import ClientSideDbCache from "./ClientSideDbCache";

const PageTransactions = () => {
  const [dtransactions, setDtransactions] = useState<DagobertTransaction[]>([]);
  const [numOfTransactions, setnumOfTransactions] = useState<number>(0);

  const [symbolPrices, setSymbolPrices] = useState<SymbolPriceIf[]>([]); //TODO move symbolPrices to PairsAndPrices and rename it to pair
  const [selectedPairs, setSelectedPairs] = useState<string[]>([]);

  const [progressInfo, setProgressInfo] = useState<string>("");
  const [pairInfo, setPairInfo] = useState<string>("");

  let useEffectFirst = true;
  useEffect(() => {
    if (useEffectFirst) {
      useEffectFirst = false;
      fetchTransactionData();
      fetchPrices();
      const intervalId = setInterval(fetchPrices, 15000);
    }
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

  const fetchPrices = async () => {
    try {
      const pairs = ClientSideDbCache.smembers(KVRoot.pairs); //await fetchh(`/api/dbapi/pairs`);
      if (!pairs) {
        setPairInfo("No any pair defined. Go to Config and add some.");
        return;
      }
      //if (pairsResponse.ok) {
      //const pairs = await pairsResponse.json();

      if ((pairs as string[]).length === 0) return;

      const response = await fetch(
        `/api/binanceapi/tickerPrice?symbols=${JSON.stringify(pairs)}`
        // ["ADAUSDT","ARBUSDT","AVAXUSDT","BNBUSDT","BTCUSDT","DOTUSDT","ETHUSDT","ICPUSDT","MATICUSDT","SHIBUSDT","SOLUSDT","TRXUSDT","XRPUSDT"]
      );

      const prices = await response.json();
      if (response.status !== 200 || prices?.code) {
        throw response.status + "-" + JSON.stringify(prices);
      }

      //(data2 as SymbolPriceIf[]).sort((a, b) => b.updateTime - a.updateTime);
      setSymbolPrices(JSON.parse(prices) as SymbolPriceIf[]);
      //}
    } catch (error) {
      console.error(`Error fetching data:`, error);
    }
  };

  return (
    <div className="mx-auto">
      <div>{progressInfo}</div>

      <PairsAndPrices
        pairsAndPrices={symbolPrices}
        setSelectedPairs={setSelectedPairs}
        selectedPairs={selectedPairs}
      />

      <div>{pairInfo}</div>

      <DTransactionCardContainer
        dtransactions={dtransactions}
        numOfTransactions={numOfTransactions}
        selectedPairs={selectedPairs}
      />
      <DTransactionGroupContainer />
    </div>
  );
};

export default PageTransactions;
