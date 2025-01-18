import React, { useEffect, useState } from "react";
import { DagobertTransaction, KVRoot } from "@/utils/typesAndEnums";
import Dtransactions from "@/app/lib/Dtransactions";
import ClientSideDbCache from "@/app/lib/ClientSideDbCache";
import { redCross } from "@/utils/helper";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRefresh, faSpinner } from "@fortawesome/free-solid-svg-icons";

const FollowedPairs: React.FC = () => {
  const [pairs, setPairs] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState<string>("");

  const defaultInfoMessage =
    "e.g.: BTCUSDT, ETHUSDT, ADAUSDT, DOTUSDT, BNBUSDT, XRPUSDT, SOLUSDT, " +
    "TRXUSDT, AVAXUSDT, MATICUSDT, SHIBUSDT, ICPUSDT, ARBUSDT, SOLUSDC, " +
    "ICPUSDC, POLUSDT, POLUSDC";
  const [info, setInfo] = useState<string>(defaultInfoMessage);

  const fetchPairs = async () => {
    const p = ClientSideDbCache.smembers(KVRoot.pairs);
    setPairs(p);
  };

  let useEffectFirst = true;
  useEffect(() => {
    if (useEffectFirst) {
      useEffectFirst = false;
      fetchPairs();
    }
  }, []);

  const handleAdd = async () => {
    const formattedInputValue = inputValue.trim().toUpperCase();
    if (formattedInputValue) {
      const success = await ClientSideDbCache.sadd(
        KVRoot.pairs,
        formattedInputValue
      );

      if (success) {
        setInputValue("");
        fetchPairs();
      }
    }
  };

  const handleFromTransactions = async () => {
    const data = Dtransactions.getAll();
    let pairs: { [key: string]: number } = {};

    if (data) {
      const dtransactions = Object.values(data) as DagobertTransaction[];
      for (const dtrans of dtransactions) {
        pairs[dtrans.pair] = 0;
        setInfo(dtrans.pair + " fetched from transactions.");
      }

      for (const pair of Object.keys(pairs)) {
        await ClientSideDbCache.sadd(KVRoot.pairs, pair);
        setInfo(pair + " added to followed pairs.");
      }

      fetchPairs();
      setInfo(defaultInfoMessage);
    }
  };

  const handleDelete = async (pair: string) => {
    const success = await ClientSideDbCache.srem(KVRoot.pairs, pair);
    if (success) {
      fetchPairs();
    }
  };

  const handleRefresh = (pair: string): void => {
    updateOrdersViaBinanceApi(pair, setInfo);
  };

  return (
    <>
      <div className="ml-8 flex flex-wrap">
        {pairs &&
          pairs.map((pair, index) => (
            <div
              key={index}
              className="w-32 bg-gray-300 text-gray-800 flex justify-between items-center space-x-1 rounded-full p-2 mr-2 mb-2"
            >
              <div className="text-xs">{pair}</div>
              <button onClick={() => handleRefresh(pair)}>
                <FontAwesomeIcon icon={faRefresh} />
              </button>
              <button className="text-xs" onClick={() => handleDelete(pair)}>
                {redCross}
              </button>
            </div>
          ))}
      </div>
      <div className="ml-8 mb-4">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="px-4 py-2 border border-gray-700 rounded bg-gray-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Add new pair"
        />
        <button
          onClick={handleAdd}
          className="ml-2 px-4 py-2 bg-blue-500 hover:bg-blue-700 text-gray-100 rounded-full font-bold transition-colors"
        >
          Add
        </button>
        <button
          onClick={handleFromTransactions}
          className="ml-2 px-4 py-2 bg-blue-500 hover:bg-blue-700 text-gray-100 rounded-full font-bold transition-colors"
        >
          from Transactions
        </button>
      </div>
      <div className="text-xs text-blue-200">
        <i>{info}</i>
      </div>
    </>
  );
};

export const updateOrdersViaBinanceApi = async (
  pair: string,
  infoFunc: (info: string) => void
) => {
  try {
    infoFunc(`Fetching ${pair} orders via Binance API`);

    const binanceResponse = await fetch(
      `/api/binanceapi/allOrders?action=AllOrders&symbol=${pair}`
    );

    const data = await binanceResponse.json();
    if (binanceResponse.status !== 200 || data?.code) {
      throw binanceResponse.status + "-" + JSON.stringify(data);
    }

    infoFunc(`${data.length} ${pair} orders fetched, update database...`);

    infoFunc(
      JSON.stringify(
        (await Dtransactions.post("binanceapi", data)).response?.pairInfo
      )
    );
  } catch (error) {
    console.error(`Error fetching data from Binance, symbol: ${pair}`, error);
  }
};

export default FollowedPairs;
