"use client";

import { useState } from "react";
import Transactions from "./components/Transactions";
import OrderHistory from "./components/OrderHistory";
import Config from "./components/Config";

const pages = {
  Transactions: Transactions,
  "Order History": OrderHistory,
  Config: Config,
};

export default function Home() {
  const [activePage, setActivePage] =
    useState<keyof typeof pages>("Transactions");

  const ActivePageComponent = pages[activePage];

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
        </nav>
      </header>
      <main className="p-8">
        <div className="container mx-auto">
          {ActivePageComponent && <ActivePageComponent />}
        </div>
      </main>
    </div>
  );
}
