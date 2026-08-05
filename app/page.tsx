"use client";

import "./globals.css";
import { useEffect, useState } from "react";
import PageTransactions from "./components/pageTransactions/PageTransactions";
import Charts from "./components/Charts";
import PageConfig from "./components/pageConfig/PageConfig";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRightFromBracket } from "@fortawesome/free-solid-svg-icons";
import PageBot from "./components/pageBot/PageBot";
import DataSourceToggle from "./components/DataSourceToggle";

const pages = {
  Transactions: PageTransactions,
  Charts: Charts,
  Config: PageConfig,
  Bot: PageBot,
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
        <header className="flex justify-between items-center p-4 border-b border-gray-700">
          <h1 className="text-4xl font-bold">Dagobert</h1>
          <nav className="flex flex-wrap items-center justify-end">
            <DataSourceToggle />
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

  return authorized ? addPageContent() : null;
}
