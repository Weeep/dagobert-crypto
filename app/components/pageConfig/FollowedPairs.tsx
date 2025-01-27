import React, { useEffect, useState } from "react";
import { KVRoot, TradeType } from "@/utils/typesAndEnums";
import Dtransactions from "@/app/lib/Dtransactions";
import ClientSideDbCache from "@/app/lib/ClientSideDbCache";
import { redCross } from "@/utils/helper";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRefresh } from "@fortawesome/free-solid-svg-icons";

interface Props {
  updateOrdersViaBinanceApiFunc: (
    pair: string,
    apiEndpoint: string,
    tradeType: TradeType,
    infoFunc: (info: string) => void
  ) => void;
  // numOfNewTransactionsUseStateFunc: (numOfNewTransactions: {
  //   [pair: string]: number;
  // }) => void;
  numOfNewTransactions: {
    [pair: string]: number;
  };
  fetchPairs: () => void;
}

const FollowedPairs: React.FC<Props> = ({
  updateOrdersViaBinanceApiFunc,
  numOfNewTransactions,
  fetchPairs,
}) => {
  const [pairs, setPairs] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState<string>("");

  const defaultInfoMessage =
    "e.g.: BTCUSDT, ETHUSDT, ADAUSDT, DOTUSDT, BNBUSDT, XRPUSDT, SOLUSDT, " +
    "TRXUSDT, AVAXUSDT, MATICUSDT, SHIBUSDT, ICPUSDT, ARBUSDT, SOLUSDC, " +
    "ICPUSDC, POLUSDT, POLUSDC";
  const [info, setInfo] = useState<string>(defaultInfoMessage);

  useEffect(() => {
    setPairs(Object.keys(numOfNewTransactions));
  }, [numOfNewTransactions]);

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
    let pairs: { [key: string]: number } = {};
    const dtransactions = Dtransactions.getAll();

    if (dtransactions) {
      //const dtransactions = Object.values(data) as DagobertTransaction[];
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
    updateOrdersViaBinanceApiFunc(
      pair,
      "/api/binanceapi/spot?action=AllOrders",
      TradeType.Spot,
      setInfo
    );
  };

  return (
    <>
      <div className="ml-8 flex flex-wrap">
        {pairs &&
          pairs.map((pair, index) => (
            <div
              key={pair + "_" + index}
              className="relative w-32 bg-gray-300 text-gray-800 flex justify-between items-center space-x-1 rounded-full p-2 mr-2 mb-2"
            >
              <div
                className={`${
                  numOfNewTransactions[pair] === 0 ? "hidden" : ""
                } absolute top-0 left-0 bg-red-500 text-white rounded-full text-xs text-center w-4 h-4`}
              >
                {numOfNewTransactions[pair]}
              </div>
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

export default FollowedPairs;
