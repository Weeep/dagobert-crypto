import { useEffect, useState } from "react";
import ProgressInfo from "../ProgressInfo";
import CsvParse from "./CsvParse";
import { Color } from "@/src/shared/ui/Color";
import { TradeType } from "@/src/modules/transaction";
import type { DagobertPair } from "@/src/modules/pair";
import { clientUseCasesSingleton } from "@/src/shared/application/clientUseCasesSingleton";
import { greenPipe, isTransactionIfArray, redCross } from "@/utils/helper";
import FollowedPairs, { PairsInfo } from "./FollowedPairs";
import { TransactionIf } from "@/app/lib/Interfaces";

const listPairsUseCase = clientUseCasesSingleton.listPairs;
const importTransactionsFromBinanceUseCase =
  clientUseCasesSingleton.importTransactionsFromBinance;

export default function PageConfig() {
  const [dbConnStatusStr, setDbConnStatusStr] = useState<string>("Checking...");
  const [isDbConnOk, setDbConn] = useState<boolean>(true);
  const [numOfNewTransactions, setNumOfNewTransactions] = useState<PairsInfo>(
    {}
  );
  const [ordersUpdateInfo, setOrdersUpdateInfo] = useState<string>(
    "Press Update to start"
  );

  const databaseConnectionCheck = async () => {
    const response = await fetch(`/api/dbapi/admin?action=connectiontest`);
    setDbConn(response.status === 200);

    const data = await response.json();
    setDbConnStatusStr(data.response);
  };

  useEffect(() => {
    databaseConnectionCheck();
    fetchPairs();
  }, []);

  const fetchPairs = async () => {
    const pairs = await listPairsUseCase.execute();

    if (pairs.length === 0) {
      setNumOfNewTransactions({});
      setOrdersUpdateInfo("No a single pair added.");
      return;
    }

    setNumOfNewTransactions(pairsToInfo(pairs));
  };

  const updateSpotBtnClicked = async () => {
    const pairs = await listPairsUseCase.execute();
    for (const pair of pairs) {
      updateOrdersViaBinanceApi(
        pair.pair,
        "/api/binanceapi/spot?action=AllOrders",
        TradeType.Spot,
        setOrdersUpdateInfo
      );
    }
  };

  const updateMarginBtnClicked = async () => {
    const pairs = await listPairsUseCase.execute();
    for (const pair of pairs) {
      updateOrdersViaBinanceApi(
        pair.pair,
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

      const pi = (
        await importTransactionsFromBinanceUseCase.execute(
          data as TransactionIf[],
          tradeType
        )
      ).response?.pairInfo;

      if (pi && pi[pair] && pi[pair].added) {
        setNumOfNewTransactions((prev) => ({
          ...prev,
          [pair]: {
            ...prev[pair],
            newTransactions: pi[pair].added,
          },
        }));
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


function pairsToInfo(pairs: DagobertPair[]): PairsInfo {
  return pairs.reduce<PairsInfo>((acc, pair) => {
    acc[pair.pair] = {
      pair: pair.pair,
      decimals: pair.decimals,
      keyLevels: pair.keyLevels,
      newTransactions: 0,
    };
    return acc;
  }, {});
}
