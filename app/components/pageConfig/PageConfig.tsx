import { useEffect, useState } from "react";
import ProgressInfo from "../ProgressInfo";
import CsvParse from "./CsvParse";
import ClientSideDbCache from "@/app/lib/ClientSideDbCache";
import {
  Color,
  DagobertTransaction,
  KVRoot,
  TradeType,
} from "@/utils/typesAndEnums";
import Dtransactions from "@/app/lib/Dtransactions";
import { greenPipe, isTransactionIfArray, redCross } from "@/utils/helper";
import FollowedPairs from "./FollowedPairs";
import { QueryOrderResult } from "binance-api-node";
import { TransactionIf } from "@/app/lib/Interfaces";

export default function PageConfig() {
  const [dbConnStatusStr, setDbConnStatusStr] = useState<string>("Checking...");
  const [isDbConnOk, setDbConn] = useState<boolean>(true);
  const [numOfNewTransactions, setNumOfNewTransactions] = useState<{
    [pair: string]: number;
  }>({});
  const [ordersUpdateInfo, setOrdersUpdateInfo] = useState<string>(
    "Press Update to start"
  );

  const databaseConnectionCheck = async () => {
    const response = await fetch(`/api/dbapi/admin?action=connectiontest`);
    setDbConn(response.status === 200);

    const data = await response.json();
    setDbConnStatusStr(data.response);
  };

  //let useEffectFirst = true;
  useEffect(() => {
    //if (useEffectFirst) {
    //  useEffectFirst = false;
    databaseConnectionCheck();

    fetchPairs();
    //}
  }, []);

  const fetchPairs = () => {
    const ps = ClientSideDbCache.smembers(KVRoot.pairs) as string[];
    if (ps) {
      const initNums: {
        [pair: string]: number;
      } = {};
      for (const p of ps) {
        initNums[p] = 0;
      }
      setNumOfNewTransactions(initNums);
    } else {
      setOrdersUpdateInfo("No a single pair added.");
    }
  };

  const updateSpotBtnClicked = async () => {
    const pairs = ClientSideDbCache.smembers(KVRoot.pairs);
    for (const pair of pairs) {
      updateOrdersViaBinanceApi(
        pair,
        "/api/binanceapi/spot?action=AllOrders",
        TradeType.Spot,
        setOrdersUpdateInfo
      );
    }
  };

  const updateMarginBtnClicked = async () => {
    const pairs = ClientSideDbCache.smembers(KVRoot.pairs);
    for (const pair of pairs) {
      updateOrdersViaBinanceApi(
        pair,
        "/api/binanceapi/margin?action=AllOrders",
        TradeType.Margin,
        setOrdersUpdateInfo
      );
    }
  };

  const updateOrdersViaBinanceApi = async (
    pair: string,
    apiEndpoint: string,
    tradeType: TradeType,
    infoFunc: (info: string) => void
  ) => {
    try {
      infoFunc(`Fetching ${pair} orders via Binance API`);

      const binanceResponse = await fetch(`${apiEndpoint}&symbol=${pair}`);

      const data = await binanceResponse.json();
      if (binanceResponse.status !== 200 || !isTransactionIfArray(data)) {
        throw binanceResponse.status + "-" + JSON.stringify(data);
      }

      infoFunc(`${data.length} ${pair} orders fetched, update database...`);

      const pi = (await Dtransactions.post(data as TransactionIf[], tradeType))
        .response?.pairInfo;

      if (pi && pi[pair] && pi[pair].added) {
        setNumOfNewTransactions((prev) => {
          prev[pair] = pi[pair].added;
          return prev;
        });
        infoFunc(JSON.stringify(pi));
      } else {
        infoFunc(
          JSON.stringify({ [pair]: { processed: 0, added: 0, skipped: 0 } })
        );
      }
    } catch (error) {
      console.error(`Error fetching data from Binance, symbol: ${pair}`, error);
    }
  };

  const addFollowedPairs = (title: string) => {
    return (
      <>
        <h2 className="text-xl font-semibold my-3">{title}</h2>
        <FollowedPairs
          updateOrdersViaBinanceApiFunc={updateOrdersViaBinanceApi}
          numOfNewTransactions={numOfNewTransactions}
          fetchPairs={fetchPairs}
        />
      </>
    );
  };

  const reactElementUpdateViaBnceApi = (title: string): React.ReactElement => {
    return (
      <>
        <h2 className="text-xl font-semibold my-3">{title}</h2>
        <div className="flex space-x-2 items-center">
          <button
            className={`ml-8 bg-blue-500 hover:bg-${Color.SpotColor} active:bg-${Color.SpotColor} text-white font-bold py-2 px-4 rounded-full focus:outline-none focus:shadow-outline-blue`}
            onClick={updateSpotBtnClicked}
          >
            Update Spot
          </button>
          <button
            className={`ml-8 bg-blue-500 hover:bg-${Color.MarginColor} active:bg-${Color.MarginColor} text-white font-bold py-2 px-4 rounded-full focus:outline-none focus:shadow-outline-blue`}
            onClick={updateMarginBtnClicked}
          >
            Update Margin
          </button>
        </div>
        <ProgressInfo info={ordersUpdateInfo} />
      </>
    );
  };

  const reactElementUpdateViaBnceCsv = (title: string): React.ReactElement => {
    return (
      <>
        <h2 className="text-xl font-semibold my-3">{title}</h2>
        <CsvParse />
      </>
    );
  };

  let i = 1;

  return (
    <>
      <h1 className="text-4xl font-semibold mb-4">Config</h1>

      <h2 className="text-xl font-semibold my-3">{i++}. Database Connection</h2>
      <p className="ml-8">
        {isDbConnOk ? greenPipe : redCross} {dbConnStatusStr}
      </p>

      <h2 className="text-xl font-semibold my-3">
        {i++}. Binance API Connection
      </h2>

      {isDbConnOk ? addFollowedPairs(`${i++}. Followed Pairs`) : ""}
      {isDbConnOk
        ? reactElementUpdateViaBnceApi(
            `${i++}. Update Transactions via Binance API`
          )
        : ""}
      {isDbConnOk
        ? reactElementUpdateViaBnceCsv(
            `${i++}. Update Transactions via Binance Trade History .csv file`
          )
        : ""}
    </>
  );
}
