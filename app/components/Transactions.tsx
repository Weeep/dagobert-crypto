import { useState, useEffect } from "react";
import { TransactionIf, SymbolPriceIf } from "./Interfaces";
import TransactionCardContainer from "./TransactionCardContainer";
import ProgressInfo from "./ProgressInfo";

const Transactions = () => {
  const [transactionData, setTransactionData] = useState<TransactionIf[]>([]);
  const [symbolPrices, setSymbolPrices] = useState<SymbolPriceIf[]>([]);
  const [progressInfo, setProgressInfo] = useState<string>("");

  let useEffectFirst = true;
  useEffect(() => {
    if (useEffectFirst) {
      useEffectFirst = false;
      fetchTransactionData();
    }
  }, []);

  const fetchTransactionData = async () => {
    const response = await fetch(`/api/transactions?status=FILLED`);
    const data = await response.json();
    if (response.status !== 200 || data?.code) {
      setProgressInfo(`\u274C ERROR: ${data.error}`);
      return;
    } else {
      console.log(`sasasa ${data.length} sasasasa`);
      //console.log("qqqqrrr" + JSON.stringify(data) + " qqqrrr");
      if (data.length === 0) {
        setProgressInfo(
          "No transaction in the database, fetch them by pressing Refresh (via binance api)."
        );
      }
      (data as TransactionIf[]).sort((a, b) => b.updateTime - a.updateTime);
      setTransactionData(data);
    }
    //} catch (error) {
    ///console.error(`Error fetching data:`, error);
    //}

    fetchPrices();
    const intervalId = setInterval(fetchPrices, 15000);
  };

  const fetchPrices = async () => {
    try {
      //const fetchPairs = async () => {
      const pairsResponse = await fetch(`/api/dbapi/pairs?key=pairs`);
      if (pairsResponse.ok) {
        const pairs = await pairsResponse.json();

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
      }
    } catch (error) {
      console.error(`Error fetching data:`, error);
    }
  };

  return (
    <div>
      <div>{progressInfo}</div>
      <TransactionCardContainer
        transactions={transactionData}
        symbolPrices={symbolPrices}
      />
    </div>
  );
};

export default Transactions;
