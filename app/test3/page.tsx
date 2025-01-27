"use client";

import React, { useState, useEffect } from "react";
import { isTransactionIf } from "@/utils/helper";
import Dtransactions from "../lib/Dtransactions";
import ClientSideDbCache from "../lib/ClientSideDbCache";
import { KVRoot, TradeType } from "@/utils/typesAndEnums";
import DtransactionGroups from "../lib/DtransactionGroups";

const Test3Page: React.FC = () => {
  const [info, setInfo] = useState<number>(0);

  useEffect(() => {
    //init();
  }, []);

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

    if (await ClientSideDbCache.initializeCache()) {
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

          setInfo((prev) => {
            return (prev += 1);
          });
        }
      }
    }
  };

  return <div>{info}</div>;
};

export default Test3Page;
