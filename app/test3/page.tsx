"use client";

import React, { useState, useEffect } from "react";
import { isTransactionIf } from "@/utils/helper";
import Dtransactions from "../lib/Dtransactions";
import ClientSideDbCache from "../lib/ClientSideDbCache";
import { KVRoot, TradeType } from "@/utils/typesAndEnums";
import DtransactionGroups from "../lib/DtransactionGroups";

const Test3Page: React.FC = () => {
  const [infoNum, setInfoNum] = useState<number>(0);
  const [infoStr, setInfoStr] = useState<string>("");

  useEffect(() => {
    const a = async () => {
      if (await ClientSideDbCache.initializeCache()) {
        //init();
        init2();
      }
    };

    a();
  }, []);

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
    // try {
    //   const marginClosedOrders = await (
    //     await fetch(`/api/binanceapi/margin?symbol=TRUMPUSDC`)
    //   ).json();
    //   for (const order of marginClosedOrders) {
    //     const a = isTransactionIf(order);
    //     setInfo((prev) => {
    //       return (prev += " " + a);
    //     });
    //   }
    // } catch (error: any) {
    //   setInfo("ERROR: " + error?.message + " | " + JSON.stringify(error));
    // }

    const dtgs = DtransactionGroups.getAll();
    if (dtgs !== null) {
      for (const dtg of dtgs) {
        const n = { tradeType: TradeType.Spot };
        await ClientSideDbCache.hset(KVRoot.dtransactionGroups, {
          [dtg.groupId as string]: {
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
