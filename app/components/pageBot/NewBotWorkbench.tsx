"use client";

import { useEffect, useMemo, useState } from "react";
import type { PairDto } from "@/src/modules/pair/dto/PairDto";
import type { StrategyDefinitionV1, StrategyValidationIssue } from "@/src/modules/strategy/domain/StrategyDefinition";
import { MARKET_INTERVALS } from "@/src/shared/domain/MarketInterval";
import { BotApiClient } from "./BotApiClient";
import { StrategyApiClient } from "./StrategyApiClient";
import { StrategyRuleNode } from "./StrategyRuleNode";
import { newCondition } from "./strategyRuleTree";

type MarketRow = { id: string; pairSymbol: string; timeframe: string; validation?: Validation };
type Validation = { valid: boolean; firstCandle: boolean; lastCandle: boolean; message: string };
const fresh = (): StrategyDefinitionV1 => ({ schemaVersion: 1, name: "New backtest strategy",
  entryPolicy: { trigger: "ON_FALSE_TO_TRUE", cooldownCandles: 0 }, entry: { all: [newCondition("RSI")] },
  exit: { all: [{ indicator: "RSI", period: 14, operator: "GTE", value: 80 }] } });
const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const input = "rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-500";

export default function NewBotWorkbench() {
  const [definition, setDefinition] = useState(fresh);
  const [json, setJson] = useState(() => JSON.stringify(fresh(), null, 2));
  const [jsonError, setJsonError] = useState(""); const [issues, setIssues] = useState<StrategyValidationIssue[]>([]);
  const [pairs, setPairs] = useState<PairDto[]>([]); const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false); const [validated, setValidated] = useState(false);
  const [from, setFrom] = useState(() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 30); return isoDate(d); });
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [rows, setRows] = useState<MarketRow[]>([{ id: crypto.randomUUID(), pairSymbol: "", timeframe: "1h" }]);
  const strategyApi = useMemo(() => new StrategyApiClient(), []);
  useEffect(() => { new BotApiClient().listPairs().then(setPairs).catch((error) => setMessage(error.message)); }, []);
  const updateDefinition = (next: StrategyDefinitionV1) => { setDefinition(next); setJson(JSON.stringify(next, null, 2)); setJsonError(""); setIssues([]); };
  const editJson = (value: string) => { setJson(value); setValidated(false); try { const parsed = JSON.parse(value) as StrategyDefinitionV1;
    setDefinition(parsed); setJsonError(""); setIssues([]); } catch { setJsonError("The JSON is not valid yet. Fix its syntax to update the visual builder."); } };
  const updateRow = (id: string, patch: Partial<MarketRow>) => { setValidated(false); setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch, validation: undefined } : row)); };
  const validate = async () => {
    setBusy(true); setMessage(""); setValidated(false);
    try {
      if (jsonError) throw new Error("Fix the strategy JSON before validation.");
      const strategy = await strategyApi.validate(definition); setIssues(strategy.issues);
      if (!strategy.valid) throw new Error("The strategy contains validation errors.");
      const response = await fetch("/api/backtest-workbench/validate", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, from: `${from}T00:00:00.000Z`, to: `${to}T23:59:59.999Z` }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error?.message ?? "Validation failed");
      setRows((current) => current.map((row) => ({ ...row, validation: body.results.find((result: { id: string }) => result.id === row.id) })));
      setValidated(true); setMessage("Validation complete. Only rows with both boundary candles will be eligible for backtesting.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Validation failed"); } finally { setBusy(false); }
  };
  const validCount = rows.filter((row) => row.validation?.valid).length;

  return <div className="mx-auto max-w-[1600px] text-slate-100">
    <div className="mb-6"><p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">New bot workbench</p>
      <h2 className="mt-1 text-3xl font-bold">Build once. Backtest many markets.</h2><p className="mt-2 text-sm text-slate-400">Create a temporary strategy and validate several pair/timeframe combinations before running them.</p></div>
    <div className="grid gap-6 xl:grid-cols-[minmax(420px,42%)_1fr]">
      <aside className="space-y-5 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto xl:pr-2">
        <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5"><label className="flex flex-col gap-2 text-sm">Strategy name<input className={input} value={definition.name} onChange={(e) => updateDefinition({ ...definition, name: e.target.value })} /></label></section>
        <div><h3 className="mb-2 font-semibold text-emerald-300">Entry conditions</h3><StrategyRuleNode condition={definition.entry} root={definition.entry} path={[]} label="Entry root" onChange={(entry) => updateDefinition({ ...definition, entry })} /></div>
        <div><h3 className="mb-2 font-semibold text-rose-300">Exit conditions</h3><StrategyRuleNode condition={definition.exit} root={definition.exit} path={[]} label="Exit root" positionConditionsAllowed onChange={(exit) => updateDefinition({ ...definition, exit })} /></div>
        <section className="rounded-2xl border border-cyan-900 bg-slate-900 p-4"><div className="mb-2 flex justify-between"><h3 className="font-semibold">Editable JSON</h3><span className="text-xs text-cyan-300">schema v1</span></div>
          <textarea aria-label="Editable strategy JSON" spellCheck={false} value={json} onChange={(e) => editJson(e.target.value)} className={`${input} min-h-80 w-full resize-y font-mono text-xs leading-5`} />
          {jsonError && <p role="alert" className="mt-2 text-xs text-rose-300">{jsonError}</p>}</section>
      </aside>
      <main className="space-y-5">
        <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5"><div className="flex items-center justify-between"><div><h3 className="text-xl font-bold">Markets</h3><p className="text-sm text-slate-400">Each valid row becomes one temporary 55 USDC bot.</p></div>
          <button className="rounded-xl border border-cyan-700 px-4 py-2 text-sm text-cyan-200" onClick={() => setRows((r) => [...r, { id: crypto.randomUUID(), pairSymbol: "", timeframe: "1h" }])}>+ Add</button></div>
          <div className="mt-4 space-y-3">{rows.map((row, index) => <div key={row.id} className="grid items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3 sm:grid-cols-[2rem_1fr_1fr_auto]">
            <span className="text-center text-sm text-slate-500">{index + 1}</span><select aria-label={`Market pair ${index + 1}`} className={input} value={row.pairSymbol} onChange={(e) => updateRow(row.id, { pairSymbol: e.target.value })}><option value="">Market pair</option>{pairs.map((p) => <option key={p.pair}>{p.pair}</option>)}</select>
            <select aria-label={`Timeframe ${index + 1}`} className={input} value={row.timeframe} onChange={(e) => updateRow(row.id, { timeframe: e.target.value })}>{MARKET_INTERVALS.map((i) => <option key={i}>{i}</option>)}</select>
            <div className="flex items-center gap-2"><span title={row.validation?.message} className={`text-xl ${row.validation?.valid ? "text-emerald-400" : row.validation ? "text-rose-400" : "text-slate-600"}`}>{row.validation?.valid ? "✓" : row.validation ? "✕" : "○"}</span>{rows.length > 1 && <button aria-label={`Remove row ${index + 1}`} onClick={() => setRows((r) => r.filter((x) => x.id !== row.id))} className="px-2 text-slate-500 hover:text-rose-300">×</button>}</div>
            {row.validation && <p className="text-xs text-slate-500 sm:col-start-2 sm:col-span-3">{row.validation.message}</p>}</div>)}</div>
        </section>
        <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5"><div className="grid gap-4 sm:grid-cols-2"><label className="flex flex-col gap-2 text-sm">From<input type="date" className={input} value={from} onChange={(e) => { setFrom(e.target.value); setValidated(false); }} /></label><label className="flex flex-col gap-2 text-sm">To<input type="date" className={input} value={to} onChange={(e) => { setTo(e.target.value); setValidated(false); }} /></label></div>
          <button disabled={busy || !from || !to || from > to} onClick={() => void validate()} className="mt-4 w-full rounded-xl border border-emerald-600 px-5 py-3 font-semibold text-emerald-200 disabled:opacity-40">{busy ? "Validating…" : "Validate strategy & candle coverage"}</button></section>
        <section className="rounded-2xl border border-emerald-900 bg-gradient-to-br from-slate-900 to-emerald-950/30 p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="text-xl font-bold">Run backtest</h3><p className="text-sm text-slate-400">Fixed settings: 55 USDC budget · 10 USDC/position · 0.001 fee · 0.001 slippage.</p></div><span className="rounded-full bg-slate-950 px-3 py-1 text-xs">{validCount} / {rows.length} ready</span></div>
          <button disabled className="mt-5 w-full rounded-xl bg-emerald-700 px-5 py-3 font-bold opacity-40">Run backtest · coming in phase 2</button><p className="mt-2 text-xs text-slate-500">Phase 2 will add in-memory bots, near-miss grouping, parallel results, and selective strategy/bot/run saving.</p></section>
        {issues.length > 0 && <div className="rounded-xl border border-rose-800 p-4 text-xs text-rose-200">{issues.map((i) => <p key={i.path}><code>{i.path}</code> — {i.message}</p>)}</div>}
        {message && <p role="status" className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm">{message}</p>}
      </main>
    </div>
  </div>;
}
