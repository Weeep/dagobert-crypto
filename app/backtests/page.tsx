"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { BacktestAnatomyStrategy } from "@/pages/api/backtests";

const number = (value: string) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 8 });
const profit = (value: string) => `${Number(value) >= 0 ? "+" : ""}${number(value)} USDC`;
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString() : "—";

export default function BacktestAnalysisPage() {
  const router = useRouter();
  const [strategies, setStrategies] = useState<BacktestAnatomyStrategy[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [visibleStrategy, setVisibleStrategy] = useState<{ name: string;
    version: BacktestAnatomyStrategy["versions"][number] } | null>(null);
  useEffect(() => { fetch("/api/backtests").then(async (response) => {
    if (response.status === 401) { router.push("/login"); return null; }
    const body = await response.json(); if (!response.ok) throw new Error(body.error?.message ?? "Could not load backtests");
    return body as { strategies: BacktestAnatomyStrategy[] };
  }).then((body) => body && setStrategies(body.strategies))
    .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load backtests"))
    .finally(() => setLoading(false)); }, [router]);

  return <main className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-8">
    <div className="mx-auto max-w-7xl">
      <a href="/" className="text-sm font-semibold text-cyan-400 hover:text-cyan-300">← Back to Dagobert</a>
      <div className="mt-5"><p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-400">Historical execution</p>
        <h1 className="mt-1 text-3xl font-bold">Backtest analysis</h1>
        <p className="mt-2 text-sm text-slate-400">Every historical run, grouped by strategy. Open a run to inspect linked entries, exits and realized profit.</p></div>
      {loading && <p className="mt-8 text-slate-400">Loading backtest history…</p>}
      {error && <p role="alert" className="mt-8 rounded-xl border border-rose-700 bg-rose-950/50 p-4 text-rose-100">{error}</p>}
      {!loading && !error && strategies.length === 0 && <p className="mt-8 rounded-xl border border-slate-700 bg-slate-900 p-6 text-slate-400">No backtests have been run yet.</p>}
      <div className="mt-8 space-y-5">{strategies.map((strategy) => <section key={strategy.id} className="overflow-hidden rounded-2xl border border-emerald-900/70 bg-slate-900">
        <div className="border-b border-slate-700 px-5 py-4"><h2 className="text-xl font-bold text-emerald-300">{strategy.name}</h2>
          <p className="mt-1 text-xs text-slate-500">{strategy.versions.length} version{strategy.versions.length === 1 ? "" : "s"} · {strategy.versions.reduce((count, version) => count + version.runs.length, 0)} runs</p></div>
        <div>{strategy.versions.map((version) => <div key={version.version ?? "unknown"} className="border-b border-slate-700 last:border-b-0">
          <div className="flex items-center justify-between bg-slate-950/40 px-5 py-3"><h3 className="font-semibold text-cyan-200">Version {version.version ?? "unknown"}</h3>
            <button type="button" className="text-sm font-semibold text-cyan-400 hover:text-cyan-300" onClick={() => setVisibleStrategy({ name: strategy.name, version })}>View strategy JSON</button></div>
          <div className="divide-y divide-slate-800">{version.runs.map((run) => <details key={run.id} className="group">
          <summary className="cursor-pointer list-none px-5 py-4 hover:bg-slate-800/60"><div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="font-semibold">{run.bot.name}</span><span className="text-sm text-slate-400">{run.bot.pair} · {run.bot.timeframe}</span></div>
              <p className="mt-1 text-xs text-slate-500">Run at {dateTime(run.startedAt)} · range {dateTime(run.from)} – {dateTime(run.to)}</p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-300">
                <span><b className="text-slate-100">{run.candleCount}</b> candles</span>
                <span><b className="text-emerald-400">{run.buyCount}</b> BUY</span><span><b className="text-rose-400">{run.sellCount}</b> SELL</span>
                {run.openBuyCount > 0 && <span className="font-semibold text-amber-300">{run.openBuyCount} open BUY</span>}
                <span>Starting balance: <b className="text-slate-100">{run.initialBalance === null ? "—" : `${number(run.initialBalance)} USDC`}</b></span>
                <span>Profit: <b className={run.netProfit === null ? "text-slate-400" : Number(run.netProfit) >= 0 ? "text-emerald-400" : "text-rose-400"}>{run.netProfit === null ? "—" : profit(run.netProfit)}</b></span>
              </div></div>
            <div className="flex items-center gap-3"><span className="rounded-full border border-slate-600 px-2.5 py-1 text-xs text-slate-300">{run.status}</span><span className="text-slate-500 group-open:rotate-180">⌄</span></div>
          </div></summary>
          <div className="border-t border-slate-800 bg-slate-950/50 p-4 md:p-5">
            {run.positions.length === 0 ? <p className="text-sm text-slate-500">No orders were filled in this run.</p> :
            <div className="overflow-x-auto rounded-xl border border-slate-700"><table className="min-w-full text-left text-sm">
              <thead className="bg-slate-950 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Pair</th><th className="px-4 py-3">Executed</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">Side</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Profit</th></tr></thead>
              <tbody className="divide-y divide-slate-800">{run.positions.map((position) => <Fragment key={position.id}>{position.fills.map((fill, index) => <tr key={`${position.id}-${fill.side}-${index}`}>
                <td className="px-4 py-3">{run.bot.pair}</td><td className="px-4 py-3"><span>{number(fill.executed)}</span><span className="block text-xs text-slate-500">{dateTime(fill.filledAt)}</span></td>
                <td className="px-4 py-3">{number(fill.price)}</td><td className={`px-4 py-3 font-bold ${fill.side === "BUY" ? "text-emerald-400" : "text-rose-400"}`}>{fill.side}</td>
                <td className="px-4 py-3">{number(fill.amount)} USDC</td>{index === 0 && <td rowSpan={position.fills.length} className={`px-4 py-3 font-bold ${position.profit === null ? "text-amber-300" : Number(position.profit) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{position.profit === null ? "Open position" : profit(position.profit)}</td>}
              </tr>)}</Fragment>)}</tbody></table></div>}
          </div>
        </details>)}</div></div>)}</div>
      </section>)}</div>
      {visibleStrategy && <div role="dialog" aria-modal="true" aria-labelledby="strategy-json-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" onClick={() => setVisibleStrategy(null)}>
        <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-cyan-800 bg-slate-900 shadow-2xl" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-slate-700 p-4"><div><h2 id="strategy-json-title" className="text-lg font-bold text-cyan-300">{visibleStrategy.name} · version {visibleStrategy.version.version ?? "unknown"}</h2><p className="text-xs text-slate-500">Immutable strategy snapshot used by these runs</p></div>
            <button type="button" onClick={() => setVisibleStrategy(null)} className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-800">Close</button></div>
          <pre className="max-h-[calc(85vh-5rem)] overflow-auto p-5 text-xs leading-5 text-slate-200">{JSON.stringify(visibleStrategy.version.definition, null, 2)}</pre>
        </div>
      </div>}
    </div>
  </main>;
}
