"use client";

import "./globals.css";
import { useEffect, useState } from "react";
import PageTransactions from "./components/pageTransactions/PageTransactions";
import Charts from "./components/Charts";
import PageConfig from "./components/pageConfig/PageConfig";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRightFromBracket } from "@fortawesome/free-solid-svg-icons";
import NewBotWorkbench from "./components/pageBot/NewBotWorkbench";
import StrategiesAndBots from "./components/pageBot/StrategiesAndBots";

const pages = {
  Transactions: PageTransactions,
  Charts: Charts,
  Config: PageConfig,
  "Strategies & Bots": StrategiesAndBots,
  "Bot Workbench": NewBotWorkbench,
};

export default function Home() {
  const [activePage, setActivePage] =
    useState<keyof typeof pages>("Transactions");
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const router = useRouter();

  const ActivePageComponent = pages[activePage];

  useEffect(() => {
    fetch("/api/auth/protected")
      .then((res) => {
        if (res.ok) {
          setAuthorized(true);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  useEffect(() => {
    if (!loading && !authorized) {
      router.push("/login");
    }
  }, [loading, authorized, router]);

  if (loading) {
    return <div className="p-8 text-xl">Loading...</div>;
  }

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
        <header className="flex flex-col gap-4 border-b border-gray-700 p-4 lg:flex-row lg:items-center lg:justify-between">
          <h1 className="text-3xl font-bold sm:text-4xl">Dagobert</h1>
          <nav className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
            {(["Transactions", "Charts", "Config"] as const).map((page) => (
              <button
                key={page}
                onClick={() => setActivePage(page as keyof typeof pages)}
                className={`min-w-0 rounded-full px-4 py-2 text-sm font-bold transition-colors sm:w-32 ${
                  activePage === page
                    ? "bg-cyan-700 text-gray-100"
                    : "bg-blue-500 hover:bg-cyan-600 text-gray-100"
                }`}
              >
                {page}
              </button>
            ))}
            <details className="group relative min-w-0">
              <summary className={`cursor-pointer list-none rounded-full px-4 py-2 text-sm font-bold ${activePage === "Strategies & Bots" || activePage === "Bot Workbench" ? "bg-cyan-700" : "bg-blue-500 hover:bg-cyan-600"}`}>Bot ▾</summary>
              <div className="mt-2 flex w-[min(19rem,calc(100vw-2rem))] flex-col gap-1 rounded-2xl border border-slate-600 bg-slate-900 p-2 shadow-2xl sm:absolute sm:right-0 sm:z-40">
                <button onClick={() => setActivePage("Strategies & Bots")} className="rounded-xl px-4 py-3 text-left text-sm hover:bg-slate-800">Strategies &amp; Bots</button>
                <button onClick={() => setActivePage("Bot Workbench")} className="rounded-xl px-4 py-3 text-left text-sm hover:bg-slate-800">Bot Workbench</button>
                <a href="/backtests" className="rounded-xl px-4 py-3 text-left text-sm hover:bg-slate-800">Backtest analysis</a>
              </div>
            </details>
            <button
              onClick={logout}
              className="w-12 rounded-full bg-blue-500 px-4 py-2 hover:bg-cyan-600"
            >
              <FontAwesomeIcon icon={faRightFromBracket} />
            </button>
          </nav>
        </header>
        <main className="min-w-0 p-3 sm:p-5 lg:p-8">
          <div className="container mx-auto">
            {ActivePageComponent && <ActivePageComponent />}
          </div>
        </main>
      </div>
    );
  };

  return authorized ? addPageContent() : null;
}
