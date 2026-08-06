import { useEffect, useState } from "react";
import ProgressInfo from "../ProgressInfo";
import CsvParse from "./CsvParse";
import { Color } from "@/src/shared/ui/Color";
import { TradeType } from "@/src/modules/transaction";
import type { DagobertPair } from "@/src/modules/pair";
import { clientUseCases } from "@/src/shared/composition/clientUseCases";
import { greenPipe, isTransactionIfArray, redCross } from "@/utils/helper";
import FollowedPairs, { PairsInfo } from "./FollowedPairs";
import { TransactionIf } from "@/app/lib/Interfaces";
import type { BinanceHealth } from "@/src/shared/infrastructure/http/binanceHealthHandler";

const listPairsUseCase = clientUseCases.listPairs;
const importTransactionsFromBinanceUseCase =
  clientUseCases.importTransactionsFromBinance;

export default function PageConfig() {
  const [dbConnStatusStr, setDbConnStatusStr] = useState<string>("Checking...");
  const [isDbConnOk, setDbConn] = useState<boolean>(true);
  const [binanceHealth, setBinanceHealth] = useState<BinanceHealth | null>(null);
  const [binanceStatus, setBinanceStatus] = useState("Checking...");
  const [isBinanceLoading, setIsBinanceLoading] = useState(true);
  const [numOfNewTransactions, setNumOfNewTransactions] = useState<PairsInfo>(
    {}
  );
  const [ordersUpdateInfo, setOrdersUpdateInfo] = useState<string>(
    "Press Update to start"
  );

  const databaseConnectionCheck = async () => {
    const response = await fetch("/api/health/database");
    setDbConn(response.status === 200);

    const data = await response.json();
    setDbConnStatusStr(
      response.ok ? "Database connection OK" : data.error?.message ?? "Database connection unavailable"
    );
  };

  const binanceConnectionCheck = async () => {
    setIsBinanceLoading(true);
    setBinanceStatus("Checking Binance API connection...");

    try {
      const response = await fetch("/api/health/binance");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error?.message ?? "Binance API connection unavailable"
        );
      }

      setBinanceHealth(result.data);
      setBinanceStatus("Binance API connection OK");
    } catch (error) {
      setBinanceHealth(null);
      setBinanceStatus(
        error instanceof Error
          ? error.message
          : "Binance API connection unavailable"
      );
    } finally {
      setIsBinanceLoading(false);
    }
  };

  useEffect(() => {
    databaseConnectionCheck();
    binanceConnectionCheck();
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
      <div className="ml-8 max-w-2xl rounded-lg border border-slate-700 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            {binanceHealth ? greenPipe : isBinanceLoading ? "⏳" : redCross}{" "}
            {binanceStatus}
          </p>
          <button
            type="button"
            onClick={binanceConnectionCheck}
            disabled={isBinanceLoading}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-wait disabled:opacity-50"
          >
            {isBinanceLoading ? "Checking…" : "Check again"}
          </button>
        </div>

        {binanceHealth && (
          <div className="mt-4">
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div className="rounded-md bg-slate-800 p-2">
                <div className="text-xs text-slate-400">Account</div>
                <div className="font-semibold">{binanceHealth.accountType}</div>
              </div>
              <div className="rounded-md bg-slate-800 p-2">
                <div className="text-xs text-slate-400">Trading</div>
                <div className={binanceHealth.canTrade ? "font-semibold text-emerald-400" : "font-semibold text-rose-400"}>
                  {binanceHealth.canTrade ? "Enabled" : "Disabled"}
                </div>
              </div>
              <div className="rounded-md bg-slate-800 p-2">
                <div className="text-xs text-slate-400">Response time</div>
                <div className="font-semibold">{binanceHealth.latencyMs} ms</div>
              </div>
              <div className="rounded-md bg-slate-800 p-2">
                <div className="text-xs text-slate-400">Server time</div>
                <div className="font-semibold">
                  {new Date(binanceHealth.serverTime).toLocaleTimeString()}
                </div>
              </div>
            </div>

            <h3 className="mb-2 mt-4 text-sm font-semibold">Available spot balances</h3>
            {binanceHealth.balances.length === 0 ? (
              <p className="text-sm text-slate-400">No available spot balance.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {binanceHealth.balances.map((balance) => (
                  <div key={balance.asset} className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm">
                    <span className="font-semibold text-blue-300">{balance.asset}</span>{" "}
                    <span className="font-mono">{balance.free}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

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
