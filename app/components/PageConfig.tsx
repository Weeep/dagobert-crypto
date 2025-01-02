import { useEffect, useState } from "react";
import ProgressInfo from "./ProgressInfo";

export default function PageConfig() {
  const [pairs, setPairs] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState<string>("");
  const [dbConnStatusStr, setDbConnStatusStr] = useState<string>("Checking...");
  const [isDbConnOk, setDbConn] = useState<boolean>(true);
  const [ordersUpdateInfo, setOrdersUpdateInfo] = useState<string>(
    "Press Update to start"
  );

  const greenPipe = "\u2705"; // ✅ Green check mark
  const redCross = "\u274C"; // ❌ Red cross

  const databaseConnectionCheck = async () => {
    const response = await fetch(`/api/dbapi/admin?action=connectiontest`);
    setDbConn(response.status === 200);

    const data = await response.json();
    setDbConnStatusStr(data.message);
  };

  const fetchPairs = async () => {
    const response = await fetch(`/api/dbapi/pairs?key=pairs`);
    if (response.ok) {
      const data = await response.json();
      setPairs(data);
    }
  };

  let useEffectFirst = true;
  useEffect(() => {
    if (useEffectFirst) {
      useEffectFirst = false;
      databaseConnectionCheck();
      fetchPairs();
    }
  }, []);

  const handleAdd = async () => {
    if (inputValue.trim()) {
      const response = await fetch("/api/dbapi/pairs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "pairs",
          value: inputValue.trim().toUpperCase(),
        }),
      });

      if (response.ok) {
        setInputValue("");
        fetchPairs();
      }
    }
  };

  const handleDelete = async (pair: string) => {
    const response = await fetch("/api/dbapi/pairs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "pairs", value: pair }),
    });

    if (response.ok) {
      setInputValue("");
      fetchPairs();
    }
  };

  const updateOrdersViaBinanceApi = async () => {
    for (const pair of pairs) {
      try {
        setOrdersUpdateInfo(`Fetching ${pair} orders via Binance API`);

        const binanceResponse = await fetch(
          `/api/binanceapi/allOrders?symbol=${pair}`
        );
        const data = await binanceResponse.json();
        if (binanceResponse.status !== 200 || data?.code) {
          throw binanceResponse.status + "-" + JSON.stringify(data);
        }

        setOrdersUpdateInfo(
          `${data.length} ${pair} orders fetched, update database...`
        );

        try {
          const dbResponse = await fetch("/api/dbapi/transactions2", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data }),
          });

          if (!dbResponse.ok) {
            throw dbResponse.status;
          } else {
            setOrdersUpdateInfo(`Database update done.`);
          }
        } catch (error) {
          console.error(`Error storing data in DB, symbol: ${pair}`, error);
        }
      } catch (error) {
        console.error(
          `Error fetching data from Binance, symbol: ${pair}`,
          error
        );
      }
    }
  };

  const addFollowedPairs = (title: string) => {
    return (
      <>
        <h2 className="text-xl font-semibold my-3">{title}</h2>

        <div className="ml-8 flex flex-wrap">
          {pairs.map((pair, index) => (
            <div
              key={index}
              className="w-24 bg-gray-300 text-gray-800 flex justify-between rounded-full p-2 mr-2 mb-2"
            >
              <div className="text-xs">{pair}</div>
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
            className="px-4 py-2 border border-gray-700 rounded bg-gray-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Add new pair"
          />
          <button
            onClick={handleAdd}
            className="ml-2 px-4 py-2 bg-blue-500 hover:bg-blue-700 text-gray-100 rounded-full font-bold transition-colors"
          >
            Add
          </button>
        </div>
      </>
    );
  };

  const addDbBinanceUpdate = (title: string) => {
    return (
      <>
        <h2 className="text-xl font-semibold my-3">{title}</h2>
        <div className="flex space-x-2 items-center">
          <button
            className="ml-8 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full focus:outline-none focus:shadow-outline-blue active:bg-blue-800"
            onClick={updateOrdersViaBinanceApi}
          >
            Update
          </button>
          <ProgressInfo info={ordersUpdateInfo} />
        </div>
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
        ? addDbBinanceUpdate(
            `${i++}. Update Orders in Database via Binance API`
          )
        : ""}
    </>
  );
}
