import { ReactElement, useEffect, useState } from "react";
import { DagobertPair, KVRoot, TradeType } from "@/utils/typesAndEnums";
import Dtransactions from "@/app/lib/Dtransactions";
import ClientSideDbCache from "@/app/lib/ClientSideDbCache";
import { redCross } from "@/utils/helper";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRefresh } from "@fortawesome/free-solid-svg-icons";

export type PairsInfo = {
  [pair: string]: {
    pair: string;
    decimals: number;
    newTransactions: number;
  };
};

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
  numOfNewTransactions: PairsInfo;
  fetchPairs: () => void;
}

const FollowedPairs: React.FC<Props> = ({
  updateOrdersViaBinanceApiFunc,
  numOfNewTransactions,
  fetchPairs,
}) => {
  const [pairs, setPairs] = useState<PairsInfo>({});
  const [inputValue, setInputValue] = useState<string>("");
  const [newDecimal, setNewDecimal] = useState<number>(0);
  const [decimalPopup, setDecimalPopup] = useState<ReactElement>(<></>);
  const [popupPair, setPopupPair] = useState<string>("");
  const [popupDecimal, setPopupDecimal] = useState<number>(0);
  const [showDecimalPopup, setShowDecimalPopup] = useState<boolean>(false);

  const defaultInfoMessage =
    "e.g.: BTCUSDT, ETHUSDT, ADAUSDT, DOTUSDT, BNBUSDT, XRPUSDT, SOLUSDT, " +
    "TRXUSDT, AVAXUSDT, MATICUSDT, SHIBUSDT, ICPUSDT, ARBUSDT, SOLUSDC, " +
    "ICPUSDC, POLUSDT, POLUSDC";
  const [info, setInfo] = useState<string>(defaultInfoMessage);

  useEffect(() => {
    setPairs(numOfNewTransactions); //Object.keys(numOfNewTransactions));
  }, [numOfNewTransactions]);

  const handleAdd = async () => {
    const formattedInputValue = inputValue.trim().toUpperCase();
    if (formattedInputValue) {
      const dpair: DagobertPair = {
        pair: formattedInputValue,
        decimals: 4,
        keyLevels: [],
      };
      const success = await ClientSideDbCache.hset(KVRoot.pairs, {
        [formattedInputValue]: dpair,
      });

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
        await ClientSideDbCache.hset(KVRoot.pairs, {
          [pair]: { pair: pair, decimals: 4 },
        });
        setInfo(pair + " added to followed pairs.");
      }

      fetchPairs();
      setInfo(defaultInfoMessage);
    }
  };

  const handleDelete = async (pair: string) => {
    const success = await ClientSideDbCache.hdel(KVRoot.pairs, pair);
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

  const decimalClicked = (pair: string, decimal: number): void => {
    setPopupPair(pair);
    setPopupDecimal(decimal);
    setShowDecimalPopup(true);
  };

  const setDecimalClicked = async () => {
    const success = await ClientSideDbCache.hset(KVRoot.pairs, {
      [popupPair]: {
        pair: popupPair,
        decimals: popupDecimal,
      } as DagobertPair,
    });
    if (success) {
      setShowDecimalPopup(false);
      fetchPairs();
    }
  };

  return (
    <>
      <div className="relative ml-8 flex flex-wrap">
        {showDecimalPopup && (
          <div className="z-50 absolute flex flex-col space-y-2 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white text-black items-center p-4 rounded">
            <div>Decimals of {popupPair}</div>
            <input
              type="text"
              value={popupDecimal}
              onChange={(event) => {
                setPopupDecimal(Number(event.target.value) || popupDecimal);
              }}
              className="w-14 px-2 py-1 text-black border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button className="dbutton" onClick={setDecimalClicked}>
              SET
            </button>
          </div>
        )}
        {pairs &&
          Object.values(pairs).map((pair, index) => (
            <div
              key={pair.pair + "_" + index}
              className="relative w-36 bg-gray-300 text-gray-800 flex justify-between items-center space-x-1 rounded-full p-2 mr-2 mb-2"
            >
              <div
                className={`${
                  pair.newTransactions === 0 ? "hidden" : ""
                } absolute top-0 left-0 bg-red-500 text-white rounded-full text-xs text-center w-4 h-4`}
              >
                {pair.newTransactions}
              </div>
              <div className="text-xs">
                {pair.pair}{" "}
                <span
                  className="cursor-pointer"
                  onClick={() => decimalClicked(pair.pair, pair.decimals)}
                >
                  .{pair.decimals}
                </span>
              </div>
              <button onClick={() => handleRefresh(pair.pair)}>
                <FontAwesomeIcon icon={faRefresh} />
              </button>
              <button
                className="text-xs"
                onClick={() => handleDelete(pair.pair)}
              >
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
        <button onClick={handleAdd} className="dbutton">
          Add
        </button>
        <button onClick={handleFromTransactions} className="dbutton">
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
