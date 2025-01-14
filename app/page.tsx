"use client";

import { Suspense, useEffect, useState } from "react";
import PageTransactions from "./components/PageTransactions";
import PageOrderHistory from "./components/PageOrderHistory";
import PageConfig from "./components/pageConfig/PageConfig";
import ClientSideDbCache from "./lib/ClientSideDbCache";
import Dtransactions from "./lib/Dtransactions";
import { DagobertTransactionGroup, KVRoot } from "@/utils/typesAndEnums";
import DtransactionGroups from "./lib/DtransactionGroups";

const pages = {
  Transactions: PageTransactions,
  "Order History": PageOrderHistory,
  Config: PageConfig,
};

export default function Home() {
  //if (typeof window === "undefined") {
  //  ukv.initializeCache();
  //  //console.log("test");
  //}

  const [activePage, setActivePage] =
    useState<keyof typeof pages>("Transactions");
  const [cacheInitialized, setCacheInitialized] = useState<boolean>(false);
  const [info, setInfo] = useState<string>("Initalizing cache...");

  const ActivePageComponent = pages[activePage];

  const initializeCache = async () => {
    try {
      const success = await ClientSideDbCache.initializeCache();
      setCacheInitialized(success);
    } catch (error) {
      setCacheInitialized(false);
      console.error("error", error);
      setInfo(
        "Exception during cache initialization: " + JSON.stringify(error)
      );
    }
  };

  let useEffectFirst = true;
  useEffect(() => {
    if (useEffectFirst) {
      useEffectFirst = false;
      initializeCache();
    }
  }, []);

  const addPageContent = () => {
    return (
      <div>
        <header className="flex justify-between items-center p-4 border-b border-gray-700">
          <h1 className="text-4xl font-bold">{"Dagobert"}</h1>
          <nav>
            {Object.keys(pages).map((page) => (
              <button
                key={page}
                onClick={() => setActivePage(page as keyof typeof pages)}
                className={`w-36 ml-4 my-1 px-4 py-2 rounded-full font-bold transition-colors ${
                  activePage === page
                    ? "bg-cyan-700 text-gray-100"
                    : "bg-blue-500 hover:bg-cyan-600 text-gray-100"
                }`}
              >
                {page}
              </button>
            ))}
          </nav>
        </header>
        <main className="p-8">
          <div className="container mx-auto">
            {ActivePageComponent && <ActivePageComponent />}
          </div>
        </main>
      </div>
    );
  };

  return (
    <>
      {/*<Suspense fallback={<div>Loading...</div>}></Suspense>*/}
      <div className="text-xl">{!cacheInitialized && `Info: ${info}`}</div>
      {cacheInitialized && addPageContent()}
      {/*<div>{JSON.stringify(ClientSideDbCache.getCache())}</div>*/}
    </>
  );
}
