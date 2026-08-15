import { useMemo, useState } from "react";
import type { BotDto } from "@/src/modules/bot/dto/BotDto";
import { BotApiClient, type BacktestView } from "./BotApiClient";
import { conditionObservationSummaries } from "./backtestDecisionPresentation";

type Props = { api: BotApiClient; bots: BotDto[] };
const date = (value: Date) => value.toISOString().slice(0, 10);
const initialTo = () => date(new Date());
const initialFrom = () => { const value = new Date(); value.setUTCDate(value.getUTCDate() - 30); return date(value); };
const number = (value: string) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 4 });
const signed = (value: string) => `${Number(value) >= 0 ? "+" : ""}${number(value)}`;

export function BacktestPanel({ api, bots }: Props) {
  const backtestBots = useMemo(() => bots.filter((bot) => bot.mode === "BACKTEST" && !bot.archivedAt), [bots]);
  const [botId, setBotId] = useState("");
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [result, setResult] = useState<BacktestView | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const run = async () => {
    setBusy(true); setMessage(""); setResult(null);
    try {
      const completed = await api.runBacktest(botId,
        new Date(`${from}T00:00:00.000Z`).toISOString(), new Date(`${to}T23:59:59.999Z`).toISOString());
      setResult(completed);
      setMessage(`Backtest completed · run ${completed.runId}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Backtest failed"); }
    finally { setBusy(false); }
  };

  return <section className="mb-10 rounded-2xl border border-emerald-800/70 bg-slate-900 p-5 shadow-lg shadow-emerald-950/20">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-400">Historical execution</p>
        <h2 className="mt-1 text-2xl font-bold">Run backtest</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">Run the selected bot against persisted closed candles. Signals execute at the next candle open with configured fees and slippage.</p></div>
      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${busy ? "border-amber-600 bg-amber-950 text-amber-200" : result ? "border-emerald-600 bg-emerald-950 text-emerald-200" : "border-slate-600 bg-slate-800 text-slate-300"}`}>
        {busy ? "RUNNING…" : result ? "COMPLETED" : "READY"}</span>
    </div>
    <div className="mt-5 grid gap-4 md:grid-cols-4">
      <label className="flex flex-col gap-2 text-sm text-slate-300">Bot<select value={botId} onChange={(event) => setBotId(event.target.value)} className={inputClass}>
        <option value="">Select a backtest bot</option>{backtestBots.map((bot) => <option key={bot.id} value={bot.id}>{bot.name} · {bot.pairSymbol} · {bot.timeframe}</option>)}</select></label>
      <label className="flex flex-col gap-2 text-sm text-slate-300">From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={inputClass} /></label>
      <label className="flex flex-col gap-2 text-sm text-slate-300">To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className={inputClass} /></label>
      <button type="button" disabled={busy || !botId || !from || !to || from > to} onClick={() => void run()}
        className="self-end rounded-xl bg-emerald-700 px-5 py-2.5 font-semibold hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40">
        {busy ? "Running backtest…" : "Run backtest"}</button>
    </div>
    {message && <div role="status" className="mt-4 rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300">{message}</div>}
    {result && <BacktestResult result={result} />}
  </section>;
}

function BacktestResult({ result }: { result: BacktestView }) {
  const metrics = [
    ["Net profit", `${signed(result.metrics.netProfit)} USDC`], ["Return", `${signed(result.metrics.returnPct)}%`],
    ["Ending equity", `${number(result.metrics.endingEquity)} USDC`], ["Max drawdown", `${number(result.metrics.maximumDrawdownPct)}%`],
    ["Closed trades", String(result.metrics.tradeCount)], ["Win rate", `${number(result.metrics.winRatePct)}%`],
    ["Fees", `${number(result.metrics.totalFees)} USDC`], ["Vs buy & hold", `${signed(result.metrics.strategyVsBuyAndHoldPct)} pp`],
  ];
  return <div className="mt-6 space-y-6 border-t border-slate-700 pt-6">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{metrics.map(([label, value]) =>
      <div key={label} className="rounded-xl border border-slate-700 bg-slate-950 p-4"><p className="text-xs uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-lg font-bold text-slate-100">{value}</p></div>)}</div>
    <div><h3 className="mb-3 text-lg font-semibold">Executed fills</h3>
      <div className="overflow-x-auto rounded-xl border border-slate-700"><table className="min-w-full text-left text-sm">
        <thead className="bg-slate-950 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Side</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">Quantity</th><th className="px-4 py-3">Fee</th></tr></thead>
        <tbody className="divide-y divide-slate-800">{result.fills.map((fill, index) => <tr key={`${fill.positionId}-${fill.side}-${index}`}>
          <td className="px-4 py-3 text-slate-300">{new Date(fill.filledAt).toLocaleString()}</td>
          <td className={`px-4 py-3 font-bold ${fill.side === "BUY" ? "text-emerald-400" : "text-rose-400"}`}>{fill.side}</td>
          <td className="px-4 py-3">{number(fill.price)}</td><td className="px-4 py-3">{number(fill.quantity)}</td><td className="px-4 py-3">{number(fill.fee)}</td>
        </tr>)}</tbody></table>{result.fills.length === 0 && <p className="p-5 text-sm text-slate-500">No orders were filled in this range.</p>}</div></div>
    <div><div className="mb-3"><h3 className="text-lg font-semibold">Decision timeline</h3>
      <p className="text-xs text-slate-500">Observed indicator values show exactly why each entry and exit condition matched or failed.</p></div>
      <div className="max-h-[32rem] space-y-2 overflow-auto pr-1">
      {result.decisions.map((decision) => <div key={decision.candleId} className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-slate-400">{new Date(decision.evaluation.evaluatedCandleOpenTime).toLocaleString()}</span>
          <span className={`font-bold ${decision.executionOutcome === "ENTRY_SUPPRESSED" ? "text-amber-400" : decision.evaluation.action === "BUY" ? "text-emerald-400" : decision.evaluation.action === "SELL" ? "text-rose-400" : "text-slate-400"}`}>
            {decision.executionOutcome === "ENTRY_SUPPRESSED" ? "BUY SUPPRESSED" : decision.evaluation.action}</span>
          <span className="text-slate-300">{decision.executionReason}</span>
        </div>
        <p className="mt-2 text-xs text-slate-500">{decision.evaluation.explanation}</p>
        {decision.evaluation.selectedPositionIds.length > 0 &&
          <p className="mt-2 text-xs text-rose-300">Selected lots: {decision.evaluation.selectedPositionIds.join(", ")}</p>}
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <ConditionDetails label="Entry" matched={decision.evaluation.entry.matched}
            summaries={conditionObservationSummaries(decision.evaluation.entry)} />
          <ConditionDetails label="Exit" matched={decision.evaluation.exit.matched}
            summaries={conditionObservationSummaries(decision.evaluation.exit)} />
        </div>
        {decision.evaluation.positionExits.length > 0 && <div className="mt-2 grid gap-2 md:grid-cols-2">
          {decision.evaluation.positionExits.map((positionExit) =>
            <ConditionDetails key={positionExit.positionId} label={`Exit · ${positionExit.positionId}`}
              matched={positionExit.evaluation.matched}
              summaries={conditionObservationSummaries(positionExit.evaluation)} />)}
        </div>}
      </div>)}</div></div>
  </div>;
}

function ConditionDetails({ label, matched, summaries }: { label: string; matched: boolean; summaries: string[] }) {
  return <div className={`rounded-lg border p-3 ${matched ? "border-emerald-900 bg-emerald-950/30" : "border-slate-800 bg-slate-900"}`}>
    <p className={`text-xs font-bold uppercase tracking-wider ${matched ? "text-emerald-400" : "text-slate-500"}`}>{label} · {matched ? "matched" : "not matched"}</p>
    <ul className="mt-2 space-y-1 text-xs text-slate-300">{summaries.map((summary, index) =>
      <li key={`${label}-${index}`}>{summary}</li>)}</ul>
  </div>;
}

const inputClass = "rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-emerald-500";
