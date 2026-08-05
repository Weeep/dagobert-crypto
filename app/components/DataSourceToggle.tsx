"use client";

import { useEffect, useState } from "react";

type DataSource = "redis" | "postgres";
const STORAGE_KEY = "dagobert-read-data-source";

export default function DataSourceToggle() {
  const [source, setSource] = useState<DataSource>("redis");

  useEffect(() => {
    if (window.localStorage.getItem(STORAGE_KEY) === "postgres") {
      setSource("postgres");
    }
  }, []);

  const select = (nextSource: DataSource) => {
    if (nextSource === source) return;
    window.localStorage.setItem(STORAGE_KEY, nextSource);
    setSource(nextSource);
    window.location.reload();
  };

  return (
    <div className="flex items-center gap-1 rounded-full border border-gray-600 p-1" aria-label="Read data source">
      <span className="px-2 text-xs text-gray-400">Adatforrás</span>
      {(["redis", "postgres"] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => select(value)}
          aria-pressed={source === value}
          className={`rounded-full px-3 py-1 text-sm font-bold transition-colors ${
            source === value
              ? "bg-emerald-600 text-white"
              : "text-gray-300 hover:bg-gray-700"
          }`}
        >
          {value === "redis" ? "Redis" : "PostgreSQL"}
        </button>
      ))}
    </div>
  );
}
