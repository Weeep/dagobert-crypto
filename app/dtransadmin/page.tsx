"use client";

import React, { useState, useEffect } from "react";
import { isTransactionIf } from "@/utils/helper";
import Dtransactions from "../lib/Dtransactions";
import ClientSideDbCache from "../lib/ClientSideDbCache";
import { KVRoot, TradeStyle, TradeType } from "@/utils/typesAndEnums";
import DtransactionGroups from "../lib/DtransactionGroups";
import { DailyStatsResult } from "binance-api-node";
import DIndicator from "../components/DIndicator";

const Test3Page: React.FC = () => {
  const [infoNum, setInfoNum] = useState<number>(0);
  const [infoStr, setInfoStr] = useState<string>("");
  const [prices, setPrices] = useState<{ symbol: string; price: string }[]>([]);

  useEffect(() => {
    //fetchCoins();
    const a = async () => {
      if (await ClientSideDbCache.initializeCache()) {
        //     //init();
        //     //init2();
        changeDtransaction("10a21bdc-e4b6-444a-90c7-8d92b1a25b51", {
          executed: 0.013,
        });
      }
    };
    a();
  }, []);

  const fetchCoins = async () => {
    const tickersRes = await fetch(
      "/api/binanceapi/tickerPrice?action=futuresdailystats"
    );
    const tickers = (await tickersRes.json()) as DailyStatsResult[];

    const pairs = tickers
      .filter((ticker) => ticker.symbol.endsWith("USDC"))
      .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .map((ticker) => ticker.symbol)
      .slice(0, 200);

    const pricesRes = await fetch(
      `/api/binanceapi/tickerPrice?symbols=${JSON.stringify(pairs)}`
    );

    setPrices((await pricesRes.json()).filter((price: any) => price.price > 0));
  };

  const changeDtransaction = async (orderId: string, newParams: object) => {
    const dt = Dtransactions.get(orderId);
    if (dt !== null) {
      //const n = { [key]: value };
      await ClientSideDbCache.hset(KVRoot.dtransactions, {
        [dt.orderId as string]: {
          ...dt,
          ...newParams,
        },
      });
    }

    const dt2 = Dtransactions.get(orderId);
    setInfoStr(JSON.stringify(dt2, null, 4));
  };

  const init2 = async () => {
    const g = DtransactionGroups.get("f9c51b17-c437-4f3e-8bda-92d69051dcd8");
    if (g !== null) {
      const n = { amount: -18.55, note: "Profit (amount) mannualy updated" };
      await ClientSideDbCache.hset(KVRoot.dtransactionGroups, {
        [g.groupId as string]: {
          ...g,
          ...n,
        },
      });
    }

    const g2 = DtransactionGroups.get("f9c51b17-c437-4f3e-8bda-92d69051dcd8");
    setInfoStr(JSON.stringify(g2, null, 4));
  };

  const init = async (): Promise<void> => {
    const dts = Dtransactions.getAll();
    if (dts !== null) {
      for (const dtg of dts) {
        const n = { tradeStyle: TradeStyle.Swing };
        await ClientSideDbCache.hset(KVRoot.dtransactions, {
          [dtg.orderId as string]: {
            ...dtg,
            ...n,
          },
        });

        setInfoNum((prev) => {
          return (prev += 1);
        });
      }
    }
  };

  return (
    <div className="flex space-x-5 flex-wrap">
      {infoStr}
      {/* prices.map((price) => {
        return (
          <DIndicator
            className="w-64 mr-4 py-2"
            key={price.symbol}
            pair={price.symbol}
            price={parseFloat(price.price)}
          />
        );
      }) */}
    </div>
  );
};

export default Test3Page;
