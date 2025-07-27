"use client";

import "./globals.css";
import { useEffect, useState } from "react";
import PageTransactions from "./components/PageTransactions";
import Charts from "./components/Charts";
import PageConfig from "./components/pageConfig/PageConfig";
import ClientSideDbCache from "./lib/ClientSideDbCache";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRightFromBracket } from "@fortawesome/free-solid-svg-icons";
import { Color } from "@/utils/typesAndEnums";

const pages = {
  Transactions: PageTransactions,
  Charts: Charts,
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
  const [info, setInfo] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const router = useRouter();

  const ActivePageComponent = pages[activePage];

  // const initializeCache = async () => {
  //   setInfo("Initalizing cache...");
  //   try {
  //     const success = await ClientSideDbCache.initializeCache();
  //     setCacheInitialized(success);
  //   } catch (error) {
  //     setCacheInitialized(false);
  //     console.error("error", error);
  //     setInfo(
  //       "Exception during cache initialization: " + JSON.stringify(error)
  //     );
  //   }
  // };

  //let useEffectFirst = true;
  useEffect(() => {
    //if (useEffectFirst) {
    //useEffectFirst = false;

    fetch("/api/auth/protected")
      .then((res) => {
        if (res.ok) {
          setAuthorized(true);
        }
      })
      .finally(() => {
        setLoading(false);
        ClientSideDbCache.initializeCache().then((success) => {
          setCacheInitialized(success);
          if (!success) {
            setInfo("Failed to initialize cache.");
          }
        });
      });

    // fetch("/api/auth/protected")
    //   .then((res) => {
    //     if (res.ok) {
    //       setAuthorized(true);
    //     } else {
    //       router.push("/login");
    //     }
    //   })
    //   .finally(() => {
    //     setLoading(false);
    //     initializeCache();
    //   });

    //}
  }, [router]);

  useEffect(() => {
    if (!loading && !authorized) {
      router.push("/login");
    }
  }, [loading, authorized, router]);

  if (loading) {
    return <div className="p-8 text-xl">Loading...</div>;
  }

  //if (!authorized) {
  //  router.push("/login");
  //}

  const logout = () => {
    fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: null,
    })
      .then((res) => {})
      .finally(() => router.push("/login"));
  };

  const addPageContent = () => {
    return (
      <div>
        <header className="flex justify-between items-center p-4 border-b border-gray-700">
          <h1 className="text-4xl font-bold">Dagobert</h1>
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
            <button
              onClick={logout}
              className="w-12 ml-4 my-1 px-4 py-2 rounded-full bg-blue-500 hover:bg-cyan-600"
            >
              <FontAwesomeIcon icon={faRightFromBracket} />
            </button>
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
      {!loading && authorized && cacheInitialized ? (
        addPageContent()
      ) : (
        <>
          <div className="flex space-x-2">
            <div className={`w-2 h-2 bg-${Color.SpotColor}`}></div>
            <div className={`w-2 h-2 bg-${Color.MarginColor}`}></div>
          </div>
          <div className="p-8 text-xl">{info}</div>
        </>
      )}
    </>
  );
}
