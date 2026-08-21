"use client";

import { useEffect, useMemo, useState } from "react";
import type { PairDto } from "@/src/modules/pair/dto/PairDto";
import type { StrategyDto } from "@/src/modules/strategy/dto/StrategyDto";
import { type StrategyDefinitionV1,
  type StrategyValidationIssue } from "@/src/modules/strategy/domain/StrategyDefinition";
import { MARKET_INTERVALS } from "@/src/shared/domain/MarketInterval";
import { BotApiClient } from "./BotApiClient";
import { StrategyApiClient } from "./StrategyApiClient";
import { StrategyRuleBuilder, parseStrategyJson } from "./StrategyRuleBuilder";
import { newCondition } from "./strategyRuleTree";

type MarketRow = { id: string; pairSymbol: string; timeframe: string; validation?: Validation };
type Validation = { valid: boolean; firstCandle: boolean; lastCandle: boolean; message: string };
type BacktestResult = { id: string; rowId: string; pairSymbol: string; timeframe: string; candleCount: number;
  decisions: { HOLD: number; BUY: number; SELL: number }; buyCount: number; sellCount: number; openBuyCount: number;
  nearMisses: { condition: string; count: number }[]; metrics: { netProfit: string; returnPct: string;
    endingEquity: string; maximumDrawdownPct: string; totalFees: string; tradeCount: number } };
const fresh = (): StrategyDefinitionV1 => ({ schemaVersion: 1, name: "New backtest strategy",
  entryPolicy: { trigger: "ON_FALSE_TO_TRUE", cooldownCandles: 0 }, entry: { all: [newCondition("RSI")] },
  exit: { all: [{ indicator: "RSI", period: 14, operator: "GTE", value: 80 }] } });
const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const input = "rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-500";
let nextRowId = 0;
const createRow = (): MarketRow => ({ id: `market-row-${Date.now()}-${nextRowId++}`, pairSymbol: "", timeframe: "1h" });
const initialRow = (): MarketRow => ({ id: "market-row-initial", pairSymbol: "", timeframe: "1h" });

export default function NewBotWorkbench() {
  const [definition, setDefinition] = useState(fresh);
  const [json, setJson] = useState(() => JSON.stringify(fresh(), null, 2));
  const [jsonError, setJsonError] = useState(""); const [issues, setIssues] = useState<StrategyValidationIssue[]>([]);
  const [pairs, setPairs] = useState<PairDto[]>([]); const [message, setMessage] = useState("");
  const [strategies, setStrategies] = useState<StrategyDto[]>([]); const [selectedStrategy, setSelectedStrategy] = useState("");
  const [busy, setBusy] = useState(false);
  const [workbenchId, setWorkbenchId] = useState(""); const [results, setResults] = useState<BacktestResult[]>([]);
  const [saving, setSaving] = useState(""); const [saved, setSaved] = useState<Record<string, string>>({});
  const [from, setFrom] = useState(() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 30); return isoDate(d); });
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [rows, setRows] = useState<MarketRow[]>(() => [initialRow()]);
  const strategyApi = useMemo(() => new StrategyApiClient(), []);
  useEffect(() => { Promise.all([new BotApiClient().listPairs(), strategyApi.list()]).then(([loadedPairs, loadedStrategies]) => { setPairs(loadedPairs); setStrategies(loadedStrategies); }).catch((error) => setMessage(error.message)); }, [strategyApi]);
  const updateDefinition = (next: StrategyDefinitionV1) => { setDefinition(next); setJson(JSON.stringify(next, null, 2)); setJsonError(""); setIssues([]); };
  const editJson = (value: string) => { setJson(value); const parsed = parseStrategyJson(value); setIssues(parsed.issues); setJsonError(parsed.error); if (parsed.definition) setDefinition(parsed.definition); };
  const selectStrategy = (id: string) => { setSelectedStrategy(id); const strategy = strategies.find((item) => item.id === id); updateDefinition(strategy ? structuredClone(strategy.versions.at(-1)!.definition) : fresh()); };
  const updateRow = (id: string, patch: Partial<MarketRow>) => setRows((current) =>
    current.map((row) => row.id === id ? { ...row, ...patch, validation: undefined } : row));
  const clearCoverage = () => setRows((current) => current.map(({ validation: _validation, ...row }) => row));
  const validate = async () => {
    setBusy(true); setMessage("");
    try {
      if (jsonError) throw new Error("Fix the strategy JSON before validation.");
      const strategy = await strategyApi.validate(definition); setIssues(strategy.issues);
      if (!strategy.valid) throw new Error("The strategy contains validation errors.");
      const response = await fetch("/api/backtest-workbench/validate", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, from: `${from}T00:00:00.000Z`, to: `${to}T23:59:59.999Z` }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error?.message ?? "Validation failed");
      setRows((current) => current.map((row) => ({ ...row, validation: body.results.find((result: { id: string }) => result.id === row.id) })));
      setMessage("Validation complete. Only rows with both boundary candles will be eligible for backtesting.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Validation failed"); } finally { setBusy(false); }
  };
  const validCount = rows.filter((row) => row.validation?.valid).length;
  const runBacktest = async () => {
    setBusy(true); setMessage(""); setResults([]); setWorkbenchId(""); setSaved({});
    try {
      if (jsonError) throw new Error("Fix the strategy JSON before running the backtest.");
      const strategy = await strategyApi.validate(definition); setIssues(strategy.issues);
      if (!strategy.valid) throw new Error("The strategy contains validation errors.");
      const coverageResponse = await fetch("/api/backtest-workbench/validate", { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows,
          from: `${from}T00:00:00.000Z`, to: `${to}T23:59:59.999Z` }) });
      const coverage = await coverageResponse.json();
      if (!coverageResponse.ok) throw new Error(coverage.error?.message ?? "Validation failed");
      setRows((current) => current.map((row) => ({ ...row,
        validation: coverage.results.find((result: { id: string }) => result.id === row.id) })));
      const eligible = rows.filter((row) => coverage.results.find((result: Validation & { id: string }) =>
        result.id === row.id)?.valid);
      if (!eligible.length) throw new Error("No row has both boundary candles; nothing can be backtested.");
      const response = await fetch("/api/backtest-workbench/run", { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ definition, rows: eligible,
          from: `${from}T00:00:00.000Z`, to: `${to}T23:59:59.999Z` }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error?.message ?? "Backtest failed");
      setWorkbenchId(body.workbenchId); setResults(body.results);
      setMessage(`${body.results.length} temporary bot backtest completed. Results remain in memory for one hour.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Backtest failed"); }
    finally { setBusy(false); }
  };
  const save = async (kind: "strategy" | "bot" | "run", resultId = "", detail = "summary") => {
    const key = `${kind}:${resultId}:${detail}`; setSaving(key); setMessage("");
    try { const response = await fetch("/api/backtest-workbench/save", { method: "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workbenchId, resultId, kind, detail }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error?.message ?? "Save failed");
      setSaved((current) => ({ ...current, [key]: "Saved" })); setMessage(`${kind} saved successfully.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Save failed"); }
    finally { setSaving(""); }
  };

  return <div className="mx-auto max-w-[1600px] text-slate-100">
    <div className="mb-6"><p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">New bot workbench</p>
      <h2 className="mt-1 text-3xl font-bold">Build once. Backtest many markets.</h2><p className="mt-2 text-sm text-slate-400">Create a temporary strategy and validate several pair/timeframe combinations before running them.</p></div>
    <div className="grid gap-6 xl:grid-cols-[minmax(420px,42%)_1fr]">
      <aside className="min-w-0 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto xl:pr-2"><StrategyRuleBuilder definition={definition} onChange={updateDefinition} json={json} onJsonChange={editJson} jsonError={jsonError} strategies={strategies} selectedId={selectedStrategy} onSelect={selectStrategy} issues={issues} /></aside>
      <main className="space-y-5">
        <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5"><div className="flex items-center justify-between"><div><h3 className="text-xl font-bold">Markets</h3><p className="text-sm text-slate-400">Each valid row becomes one temporary 55 USDC bot.</p></div>
          <button className="rounded-xl border border-cyan-700 px-4 py-2 text-sm text-cyan-200" onClick={() => setRows((r) => [...r, createRow()])}>+ Add</button></div>
          <div className="mt-4 space-y-3">{rows.map((row, index) => <div key={row.id} className="grid items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3 sm:grid-cols-[2rem_1fr_1fr_auto]">
            <span className="text-center text-sm text-slate-500">{index + 1}</span><select aria-label={`Market pair ${index + 1}`} className={input} value={row.pairSymbol} onChange={(e) => updateRow(row.id, { pairSymbol: e.target.value })}><option value="">Market pair</option>{pairs.map((p) => <option key={p.pair}>{p.pair}</option>)}</select>
            <select aria-label={`Timeframe ${index + 1}`} className={input} value={row.timeframe} onChange={(e) => updateRow(row.id, { timeframe: e.target.value })}>{MARKET_INTERVALS.map((i) => <option key={i}>{i}</option>)}</select>
            <div className="flex items-center gap-2"><span title={row.validation?.message} className={`text-xl ${row.validation?.valid ? "text-emerald-400" : row.validation ? "text-rose-400" : "text-slate-600"}`}>{row.validation?.valid ? "✓" : row.validation ? "✕" : "○"}</span>{rows.length > 1 && <button aria-label={`Remove row ${index + 1}`} onClick={() => setRows((r) => r.filter((x) => x.id !== row.id))} className="px-2 text-slate-500 hover:text-rose-300">×</button>}</div>
            {row.validation && <p className="text-xs text-slate-500 sm:col-start-2 sm:col-span-3">{row.validation.message}</p>}</div>)}</div>
        </section>
        <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5"><div className="grid gap-4 sm:grid-cols-2"><label className="flex flex-col gap-2 text-sm">From<input type="date" className={input} value={from} onChange={(e) => { setFrom(e.target.value); clearCoverage(); }} /></label><label className="flex flex-col gap-2 text-sm">To<input type="date" className={input} value={to} onChange={(e) => { setTo(e.target.value); clearCoverage(); }} /></label></div>
          <button disabled={busy || !from || !to || from > to} onClick={() => void validate()} className="mt-4 w-full rounded-xl border border-emerald-600 px-5 py-3 font-semibold text-emerald-200 disabled:opacity-40">{busy ? "Validating…" : "Validate strategy & candle coverage"}</button></section>
        <section className="rounded-2xl border border-emerald-900 bg-gradient-to-br from-slate-900 to-emerald-950/30 p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="text-xl font-bold">Run backtest</h3><p className="text-sm text-slate-400">Fixed settings: 55 USDC budget · 10 USDC/position · 0.001 fee · 0.001 slippage.</p></div><span className="rounded-full bg-slate-950 px-3 py-1 text-xs">{validCount} / {rows.length} ready</span></div>
          <button disabled={busy || !from || !to || from > to} onClick={() => void runBacktest()} className="mt-5 w-full rounded-xl bg-emerald-700 px-5 py-3 font-bold hover:bg-emerald-600 disabled:opacity-40">{busy ? "Validating & running…" : "Run backtest"}</button><p className="mt-2 text-xs text-slate-500">Validation is repeated automatically. Rows without complete boundary coverage are skipped.</p></section>
        {results.length > 0 && <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-2xl font-bold">Parallel results</h3><p className="text-sm text-slate-400">Temporary results are not written to the database until you choose what to save.</p></div>
          <button disabled={Boolean(saving) || Boolean(saved["strategy::summary"])} onClick={() => void save("strategy")} className="rounded-xl border border-cyan-600 px-4 py-2 text-sm text-cyan-200 disabled:opacity-50">{saved["strategy::summary"] ?? "Save strategy"}</button></div>
          {results.map((result) => <article key={result.id} className="rounded-2xl border border-slate-700 bg-slate-900 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-xl font-bold text-cyan-200">{result.pairSymbol} · {result.timeframe}</h4><p className="text-xs text-slate-500">{result.candleCount} candles evaluated</p></div><div className={`text-right ${Number(result.metrics.netProfit) >= 0 ? "text-emerald-300" : "text-rose-300"}`}><strong className="text-xl">{result.metrics.netProfit} USDC</strong><p className="text-xs">{result.metrics.returnPct}% return</p></div></div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"><div className="rounded-lg bg-slate-950 p-3"><span className="text-slate-500">BUY fills</span><strong className="block">{result.buyCount}</strong></div><div className="rounded-lg bg-slate-950 p-3"><span className="text-slate-500">SELL fills</span><strong className="block">{result.sellCount}</strong></div><div className="rounded-lg bg-slate-950 p-3"><span className="text-slate-500">Open BUYs</span><strong className="block">{result.openBuyCount}</strong></div><div className="rounded-lg bg-slate-950 p-3"><span className="text-slate-500">Max drawdown</span><strong className="block">{result.metrics.maximumDrawdownPct}%</strong></div></div>
            {result.nearMisses.length > 0 && <div className="mt-4 rounded-xl border border-amber-900/70 bg-amber-950/20 p-4"><h5 className="font-semibold text-amber-200">1 condition missed</h5><div className="mt-2 flex flex-wrap gap-2">{result.nearMisses.map((miss) => <span key={miss.condition} className="rounded-full bg-slate-950 px-3 py-1 text-xs"><strong className="text-amber-300">{miss.count}</strong> {miss.condition}</span>)}</div></div>}
            <div className="mt-4 flex flex-wrap gap-2">{(["bot", "run"] as const).map((kind) => kind === "bot" ? <button key={kind} disabled={Boolean(saving) || Boolean(saved[`bot:${result.id}:summary`])} onClick={() => void save("bot", result.id)} className="rounded-lg border border-slate-600 px-3 py-2 text-xs disabled:opacity-50">{saved[`bot:${result.id}:summary`] ?? "Save bot"}</button> : <span key={kind} className="contents"><button disabled={Boolean(saving) || Boolean(saved[`run:${result.id}:summary`])} onClick={() => void save("run", result.id, "summary")} className="rounded-lg border border-emerald-700 px-3 py-2 text-xs text-emerald-200 disabled:opacity-50">{saved[`run:${result.id}:summary`] ?? "Save run · BUY/SELL only"}</button><button disabled={Boolean(saving) || Boolean(saved[`run:${result.id}:detailed`])} onClick={() => void save("run", result.id, "detailed")} className="rounded-lg border border-cyan-700 px-3 py-2 text-xs text-cyan-200 disabled:opacity-50">{saved[`run:${result.id}:detailed`] ?? "Save detailed run"}</button></span>)}</div>
          </article>)}</section>}
        {issues.length > 0 && <div className="rounded-xl border border-rose-800 p-4 text-xs text-rose-200">{issues.map((i) => <p key={i.path}><code>{i.path}</code> — {i.message}</p>)}</div>}
        {message && <p role="status" className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm">{message}</p>}
      </main>
    </div>
  </div>;
}
