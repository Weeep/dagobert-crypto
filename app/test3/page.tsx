"use client";

import React, { useState, useEffect } from "react";
import { isTransactionIf } from "@/utils/helper";
import Dtransactions from "../lib/Dtransactions";
import ClientSideDbCache from "../lib/ClientSideDbCache";
import { KVRoot, TradeStyle, TradeType } from "@/utils/typesAndEnums";
import DtransactionGroups from "../lib/DtransactionGroups";

const Test3Page: React.FC = () => {
  const [infoNum, setInfoNum] = useState<number>(0);
  const [infoStr, setInfoStr] = useState<string>("");

  useEffect(() => {
    const a = async () => {
      if (await ClientSideDbCache.initializeCache()) {
        //init();
        //init2();
        //changeDtransaction("9bc3cf04-e446-4fd4-992c-5711e9da21c1", {
        //  tradeStyle: TradeStyle.Swing,
        //});
      }
    };

    a();
  }, []);

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
    <>
      <div>{infoNum}</div>
      <div>{infoStr}</div>
    </>
  );
};

export default Test3Page;
