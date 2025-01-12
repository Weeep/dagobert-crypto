import { useEffect, useState } from "react";
import ProgressInfo from "../ProgressInfo";
import CsvParse from "./CsvParse";
import ClientSideDbCache from "@/app/lib/ClientSideDbCache";
import { DagobertTransaction, KVRoot } from "@/utils/typesAndEnums";
import Dtransactions from "@/app/lib/Dtransactions";
import { greenPipe, redCross } from "@/utils/helper";
import FollowedPairs, { updateOrdersViaBinanceApi } from "./FollowedPairs";

export default function PageConfig() {
  const [dbConnStatusStr, setDbConnStatusStr] = useState<string>("Checking...");
  const [isDbConnOk, setDbConn] = useState<boolean>(true);
  const [ordersUpdateInfo, setOrdersUpdateInfo] = useState<string>(
    "Press Update to start"
  );

  const databaseConnectionCheck = async () => {
    const response = await fetch(`/api/dbapi/admin?action=connectiontest`);
    setDbConn(response.status === 200);

    const data = await response.json();
    setDbConnStatusStr(data.response);
  };

  let useEffectFirst = true;
  useEffect(() => {
    if (useEffectFirst) {
      useEffectFirst = false;
      databaseConnectionCheck();
      //fetchPairs();
    }
  }, []);

  const updateBtnClicked = async () => {
    const pairs = ClientSideDbCache.smembers(KVRoot.pairs);
    for (const pair of pairs) {
      updateOrdersViaBinanceApi(pair, setOrdersUpdateInfo);
    }
  };

  const addFollowedPairs = (title: string) => {
    return (
      <>
        <h2 className="text-xl font-semibold my-3">{title}</h2>
        <FollowedPairs />
      </>
    );
  };

  const updateTransactionsBinanceApi = (title: string) => {
    return (
      <>
        <h2 className="text-xl font-semibold my-3">{title}</h2>
        <div className="flex space-x-2 items-center">
          <button
            className="ml-8 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full focus:outline-none focus:shadow-outline-blue active:bg-blue-800"
            onClick={updateBtnClicked}
          >
            Update
          </button>
          <ProgressInfo info={ordersUpdateInfo} />
        </div>
      </>
    );
  };

  const updateTransactionsBinanceCsv = (title: string) => {
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
        ? updateTransactionsBinanceApi(
            `${i++}. Update Transactions via Binance API`
          )
        : ""}
      {isDbConnOk
        ? updateTransactionsBinanceCsv(
            `${i++}. Update Transactions via Binance Trade History .csv file`
          )
        : ""}
    </>
  );
}
