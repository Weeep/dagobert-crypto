import { useMemo, useState } from "react";
import type { BotDto } from "@/src/modules/bot/dto/BotDto";
import type { PairDto } from "@/src/modules/pair/dto/PairDto";
import type { StrategyDto } from "@/src/modules/strategy/dto/StrategyDto";
import { MARKET_INTERVALS } from "@/src/shared/domain/MarketInterval";
import { BotApiClient, type CreateBotRequest } from "./BotApiClient";

type Props = {
  api: BotApiClient;
  bots: BotDto[];
  pairs: PairDto[];
  strategies: StrategyDto[];
  loading: boolean;
  onCreated: (bot: BotDto) => void;
};

const initialForm = (): CreateBotRequest => ({
  name: "", pairSymbol: "", assignedBudget: "1000", amountPerPosition: "100",
  timeframe: "1h", strategyVersionId: "", feeRate: "0.001", slippageRate: "0",
});

export function BotCreator({ api, bots, pairs, strategies, loading, onCreated }: Props) {
  const [form, setForm] = useState<CreateBotRequest>(initialForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const versions = useMemo(() => strategies.flatMap((strategy) =>
    strategy.versions.map((version) => ({
      id: version.id, label: `${strategy.name} · v${version.version}`,
    }))), [strategies]);

  const update = (field: keyof CreateBotRequest, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  const create = async () => {
    setBusy(true); setMessage("");
    try {
      const bot = await api.create(form);
      onCreated(bot);
      setForm(initialForm());
      setMessage(`${bot.name} created as a backtest draft.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create bot");
    } finally { setBusy(false); }
  };

  const canSubmit = !loading && !busy && form.name.trim() !== "" && form.pairSymbol !== "" &&
    form.strategyVersionId !== "" && form.assignedBudget !== "" && form.amountPerPosition !== "";

  return <section className="mb-10 rounded-2xl border border-cyan-800/70 bg-slate-900 p-5 shadow-lg shadow-cyan-950/20">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">Bot configuration</p>
        <h2 className="mt-1 text-2xl font-bold">Create trading bot</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">Choose a persisted pair, timeframe, and immutable strategy version. The bot is saved in the canonical Bot store used by the lifecycle and market-data services.</p>
      </div>
      <span className="rounded-full border border-amber-700 bg-amber-950/50 px-3 py-1 text-xs font-semibold text-amber-200">BACKTEST · DRAFT</span>
    </div>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Field label="Bot name"><input required maxLength={120} value={form.name} onChange={(event) => update("name", event.target.value)} className={inputClass} placeholder="BTC hourly bot" /></Field>
      <Field label="Market pair"><select required value={form.pairSymbol} onChange={(event) => update("pairSymbol", event.target.value)} className={inputClass}>
        <option value="">Select a followed pair</option>{pairs.map((pair) => <option key={pair.pair} value={pair.pair}>{pair.pair}</option>)}
      </select></Field>
      <Field label="Timeframe"><select value={form.timeframe} onChange={(event) => update("timeframe", event.target.value)} className={inputClass}>
        {MARKET_INTERVALS.map((interval) => <option key={interval}>{interval}</option>)}
      </select></Field>
      <Field label="Strategy version"><select required value={form.strategyVersionId} onChange={(event) => update("strategyVersionId", event.target.value)} className={inputClass}>
        <option value="">Select an immutable version</option>{versions.map((version) => <option key={version.id} value={version.id}>{version.label}</option>)}
      </select></Field>
      <Field label="Assigned budget (USDC)"><input inputMode="decimal" value={form.assignedBudget} onChange={(event) => update("assignedBudget", event.target.value)} className={inputClass} /></Field>
      <Field label="Amount per position (USDC)"><input inputMode="decimal" value={form.amountPerPosition} onChange={(event) => update("amountPerPosition", event.target.value)} className={inputClass} /></Field>
      <Field label="Fee rate" hint="0.001 = 0.1%"><input inputMode="decimal" value={form.feeRate} onChange={(event) => update("feeRate", event.target.value)} className={inputClass} /></Field>
      <Field label="Slippage rate" hint="0.001 = 0.1%"><input inputMode="decimal" value={form.slippageRate} onChange={(event) => update("slippageRate", event.target.value)} className={inputClass} /></Field>
    </div>

    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-700 pt-5">
      <div className="text-xs text-slate-400">
        {loading ? "Loading bot dependencies…" : `${bots.length} bot${bots.length === 1 ? "" : "s"} configured · ${pairs.length} pair${pairs.length === 1 ? "" : "s"} available`}
        <p className="mt-1 text-slate-500">Live polling begins automatically after a future non-backtest run is started; drafts and backtests intentionally do not subscribe.</p>
      </div>
      <button type="button" disabled={!canSubmit} onClick={() => void create()} className="rounded-xl bg-cyan-700 px-6 py-3 font-semibold hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-40">
        {busy ? "Creating…" : "Create bot"}
      </button>
    </div>
    {message && <div role="status" className="mt-4 rounded-xl border border-slate-600 bg-slate-800 p-3 text-sm text-slate-200">{message}</div>}
  </section>;
}

const inputClass = "rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-500";
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-2 text-sm text-slate-300"><span>{label}{hint && <span className="ml-2 text-xs text-slate-500">{hint}</span>}</span>{children}</label>;
}
