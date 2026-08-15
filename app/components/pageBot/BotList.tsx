import { useMemo, useState } from "react";
import type { BotDto } from "@/src/modules/bot";
import type { PairDto } from "@/src/modules/pair/dto/PairDto";
import type { StrategyDto } from "@/src/modules/strategy/dto/StrategyDto";
import { MARKET_INTERVALS } from "@/src/shared/domain/MarketInterval";
import { BotApiClient, type BotErrorDetails, type CreateBotRequest } from "./BotApiClient";

type Props = { api: BotApiClient; bots: BotDto[]; pairs: PairDto[]; strategies: StrategyDto[];
  loading: boolean; onChanged: (bot: BotDto) => void; onDeleted: (id: string) => void };

export function BotList({ api, bots, pairs, strategies, loading, onChanged, onDeleted }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<CreateBotRequest>>({});
  const [showArchived, setShowArchived] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorDetails, setErrorDetails] = useState<{ botId: string; details: BotErrorDetails | null } | null>(null);
  const versions = useMemo(() => strategies.flatMap((strategy) => strategy.versions.map((version) =>
    ({ id: version.id, label: `${strategy.name} · v${version.version}` }))), [strategies]);
  const strategyName = (id: string) => versions.find((version) => version.id === id)?.label ?? "Unknown strategy";
  const visible = bots.filter((bot) => showArchived || !bot.archivedAt);
  const beginEdit = (bot: BotDto) => { setEditing(bot.id); setMessage(""); setForm({ name: bot.name,
    pairSymbol: bot.pairSymbol, timeframe: bot.timeframe, strategyVersionId: bot.strategyVersionId,
    assignedBudget: bot.assignedBudget, amountPerPosition: bot.amountPerPosition,
    feeRate: bot.feeRate, slippageRate: bot.slippageRate }); };
  const save = async (id: string) => { setBusy(true); setMessage(""); try { onChanged(await api.update(id, form)); setEditing(null); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not update bot"); } finally { setBusy(false); } };
  const archive = async (bot: BotDto) => { setBusy(true); setMessage(""); try { onChanged(await api.update(bot.id, { archived: !bot.archivedAt })); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not archive bot"); } finally { setBusy(false); } };
  const remove = async (bot: BotDto) => { if (!window.confirm(`Permanently delete “${bot.name}” and all of its runs, tests, decisions, and trading records? This cannot be undone.`)) return;
    setBusy(true); setMessage(""); try { await api.delete(bot.id); onDeleted(bot.id); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not delete bot"); } finally { setBusy(false); } };
  const field = (key: keyof CreateBotRequest, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const showError = async (botId: string) => { if (errorDetails?.botId === botId) { setErrorDetails(null); return; }
    setBusy(true); setMessage(""); try { setErrorDetails({ botId, details: await api.errorDetails(botId) }); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not load error details"); } finally { setBusy(false); } };

  return <section className="mb-8 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 p-5">
      <div><p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">Trading bots</p><h2 className="mt-1 text-2xl font-bold">Existing bots</h2></div>
      <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived</label>
    </div>
    <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm">
      <thead className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400"><tr>{["Name", "Pair", "Timeframe", "Strategy", "Balance", "Mode / status", ""].map((title) => <th key={title} className="px-4 py-3">{title}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-800">{visible.map((bot) => <tr key={bot.id} className={bot.archivedAt ? "text-slate-500" : "text-slate-200"}>
        {editing === bot.id ? <><td className="p-3"><input className={inputClass} value={form.name} onChange={(e) => field("name", e.target.value)} /></td>
          <td className="p-3"><select className={inputClass} value={form.pairSymbol} onChange={(e) => field("pairSymbol", e.target.value)}>{pairs.map((p) => <option key={p.pair}>{p.pair}</option>)}</select></td>
          <td className="p-3"><select className={inputClass} value={form.timeframe} onChange={(e) => field("timeframe", e.target.value)}>{MARKET_INTERVALS.map((v) => <option key={v}>{v}</option>)}</select></td>
          <td className="p-3"><select className={inputClass} value={form.strategyVersionId} onChange={(e) => field("strategyVersionId", e.target.value)}>{versions.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select></td>
          <td className="p-3"><input className={inputClass} value={form.assignedBudget} onChange={(e) => field("assignedBudget", e.target.value)} /></td>
          <td className="px-4 py-3">{bot.mode} / {bot.status}</td><td className="p-3 whitespace-nowrap"><button disabled={busy} onClick={() => void save(bot.id)} className="text-cyan-300">Save</button> <button onClick={() => setEditing(null)} className="ml-3">Cancel</button></td></>
        : <><td className="px-4 py-4 font-semibold">{bot.name}{bot.archivedAt && <span className="ml-2 text-xs">Archived</span>}</td><td className="px-4 py-4">{bot.pairSymbol}</td><td className="px-4 py-4">{bot.timeframe}</td><td className="px-4 py-4">{strategyName(bot.strategyVersionId)}</td><td className="px-4 py-4">{bot.assignedBudget} USDC</td><td className="px-4 py-4"><button type="button" disabled={busy || bot.status !== "ERROR"} onClick={() => void showError(bot.id)} className={`rounded-full bg-slate-800 px-2 py-1 text-xs ${bot.status === "ERROR" ? "cursor-pointer text-rose-300 hover:bg-rose-950" : "cursor-default"}`}>{bot.mode} · {bot.status}</button></td>
          <td className="px-4 py-4 whitespace-nowrap"><button aria-label={`Edit ${bot.name}`} title="Edit" disabled={busy || !!bot.archivedAt} onClick={() => beginEdit(bot)} className="text-lg disabled:opacity-30">✎</button><button disabled={busy} onClick={() => void archive(bot)} className="ml-3 text-xs text-amber-300">{bot.archivedAt ? "Restore" : "Archive"}</button><button disabled={busy} onClick={() => void remove(bot)} className="ml-3 text-xs text-rose-400">Delete</button></td></>}</tr>)}
        {!loading && visible.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No bots to display.</td></tr>}</tbody>
    </table></div>{errorDetails && <div className="border-t border-rose-900 bg-rose-950/30 p-4 text-sm text-rose-100">
      {errorDetails.details ? <><p className="font-semibold">Latest execution error</p><p className="mt-1">{errorDetails.details.message}</p><p className="mt-2 text-xs text-rose-300">{new Date(errorDetails.details.occurredAt).toLocaleString()} · run {errorDetails.details.runId}</p></>
        : <p>No detailed error was recorded for this bot.</p>}</div>}{message && <p role="status" className="border-t border-slate-700 p-3 text-sm text-rose-300">{message}</p>}
  </section>;
}
const inputClass = "w-full min-w-24 rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-slate-100";
