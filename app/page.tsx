"use client";

import { useState } from "react";
import Transactions from "./components/Transactions";
import OrderHistory from "./components/OrderHistory";
import Configure from "./components/Configure";

const pages = {
  Transactions: Transactions,
  "Order History": OrderHistory,
  Configure: Configure,
};

export default function Home() {
  const [activePage, setActivePage] =
    useState<keyof typeof pages>("Transactions");

  const ActivePageComponent = pages[activePage];

  return (
    <div>
      <header className="flex justify-between items-center p-4 border-b border-gray-700">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <nav className="space-x-4">
          {Object.keys(pages).map((page) => (
            <button
              key={page}
              onClick={() => setActivePage(page as keyof typeof pages)}
              className={`px-4 py-2 rounded transition-colors ${
                activePage === page
                  ? "bg-cyan-700 text-gray-900"
                  : "bg-cyan-500 hover:bg-cyan-600 text-gray-100"
              }`}
            >
              {page}
            </button>
          ))}
        </nav>
      </header>
      <main className="p-8">
        <div className="container mx-auto text-center">
          {ActivePageComponent && <ActivePageComponent />}
        </div>
      </main>
    </div>
  );
}
