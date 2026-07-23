import { useEffect, useState } from "react";
import { TradeType } from "@/src/modules/transaction";
import { clientUseCasesSingleton } from "@/src/shared/application/clientUseCasesSingleton";
import { redCross } from "@/utils/helper";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRefresh, faGear } from "@fortawesome/free-solid-svg-icons";

const createPairUseCase = clientUseCasesSingleton.createPair;
const updatePairSettingsUseCase = clientUseCasesSingleton.updatePairSettings;
const deletePairUseCase = clientUseCasesSingleton.deletePair;
const createPairsFromTransactionsUseCase =
  clientUseCasesSingleton.createPairsFromTransactions;

export type PairsInfo = {
  [pair: string]: {
    pair: string;
    decimals: number;
    keyLevels: number[];
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
  numOfNewTransactions: PairsInfo;
  fetchPairs: () => Promise<void>;
}

const FollowedPairs: React.FC<Props> = ({
  updateOrdersViaBinanceApiFunc,
  numOfNewTransactions,
  fetchPairs,
}) => {
  const [pairs, setPairs] = useState<PairsInfo>({});
  const [inputValue, setInputValue] = useState<string>("");
  const [popupPair, setPopupPair] = useState<string>("");
  const [popupDecimal, setPopupDecimal] = useState<number>(0);
  const [popupKeyLevels, setPopupKeyLevels] = useState<number[]>([]);
  const [newLimit, setNewLimit] = useState<number>(0);

  const [showPairSettingsPopup, setShowPairSettingsPopup] =
    useState<boolean>(false);

  const defaultInfoMessage =
    "e.g.: BTCUSDT, ETHUSDT, ADAUSDT, DOTUSDT, BNBUSDT, XRPUSDT, SOLUSDT, " +
    "TRXUSDT, AVAXUSDT, MATICUSDT, SHIBUSDT, ICPUSDT, ARBUSDT, SOLUSDC, " +
    "ICPUSDC, POLUSDT, POLUSDC";
  const [info, setInfo] = useState<string>(defaultInfoMessage);

  useEffect(() => {
    setPairs(numOfNewTransactions);
  }, [numOfNewTransactions]);

  const handleAdd = async () => {
    const result = await createPairUseCase.execute({ pair: inputValue });

    if (result.ok) {
      setInputValue("");
      await fetchPairs();
      setInfo(defaultInfoMessage);
    } else {
      setInfo(result.error);
    }
  };

  const handleFromTransactions = async () => {
    const result = await createPairsFromTransactionsUseCase.execute();

    if (result.ok) {
      await fetchPairs();
      setInfo(
        `${result.createdPairs.length} pair(s) added from transactions, ` +
          `${result.skippedPairs.length} already existed.`
      );
    } else {
      setInfo(result.error);
    }
  };

  const handleDelete = async (pair: string) => {
    const result = await deletePairUseCase.execute(pair);
    if (result.ok) {
      await fetchPairs();
      setInfo(defaultInfoMessage);
    } else {
      setInfo(result.error);
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

  const addNewLimitClicked = (): void => {
    setPopupKeyLevels((prev) => [...prev, newLimit]);
  };

  const pairSettingsClicked = (
    pair: string,
    decimal: number,
    keyLevels: number[]
  ): void => {
    setPopupPair(pair);
    setPopupDecimal(decimal);
    setPopupKeyLevels(keyLevels);
    setShowPairSettingsPopup(true);
  };

  const setPairSettingsClicked = async () => {
    const result = await updatePairSettingsUseCase.execute({
      pair: popupPair,
      decimals: popupDecimal,
      keyLevels: popupKeyLevels,
    });

    if (result.ok) {
      setShowPairSettingsPopup(false);
      await fetchPairs();
      setInfo(defaultInfoMessage);
    } else {
      setInfo(result.error);
    }
  };

  return (
    <>
      <div className="relative ml-8 flex flex-wrap">
        {showPairSettingsPopup && (
          <div className="w-[300px] z-50 absolute flex flex-col space-y-2 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white text-black items-center p-4 rounded">
            <div className="text-xl font-bold bg-blue">{popupPair}</div>

            <div className="pt-2 font-bold">Decimals</div>
            <input
              type="text"
              value={popupDecimal}
              onChange={(event) => {
                setPopupDecimal(Number(event.target.value) || popupDecimal);
              }}
              className="w-14 px-2 py-1 text-black border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="pt-2 font-bold">Key limits</div>
            <div>
              <div className="text-center">
                {!popupKeyLevels.length
                  ? "No key limit set"
                  : popupKeyLevels.join(", ")}
              </div>
              <input
                type="number"
                value={newLimit}
                onChange={(event) => {
                  setNewLimit(Number(event.target.value));
                }}
                className="w-14 px-2 py-1 text-black border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button className="dbutton" onClick={addNewLimitClicked}>
                Add
              </button>
            </div>

            <div className="flex pt-4">
              <button className="dbutton" onClick={setPairSettingsClicked}>
                SET
              </button>
              <button
                className="dbutton"
                onClick={() => setShowPairSettingsPopup(false)}
              >
                CANCEL
              </button>
            </div>
          </div>
        )}
        {pairs &&
          Object.values(pairs).map((pair, index) => (
            <div
              key={pair.pair + "_" + index}
              className="relative w-40 bg-gray-300 text-gray-800 flex justify-between items-center space-x-1 rounded-full p-2 mr-2 mb-2"
            >
              <div
                className={`${
                  pair.newTransactions === 0 ? "hidden" : ""
                } absolute top-0 left-0 bg-red-500 text-white rounded-full text-xs text-center w-4 h-4`}
              >
                {pair.newTransactions}
              </div>
              <span className="text-xs">
                {pair.pair} .{pair.decimals}
              </span>
              <button
                onClick={() =>
                  pairSettingsClicked(pair.pair, pair.decimals, pair.keyLevels)
                }
              >
                <FontAwesomeIcon icon={faGear} />
              </button>
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
