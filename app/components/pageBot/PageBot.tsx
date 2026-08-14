"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { StrategyDto } from "@/src/modules/strategy/dto/StrategyDto";
import type { StrategyDefinitionV1, StrategyValidationIssue } from "@/src/modules/strategy/domain/StrategyDefinition";
import { StrategyApiClient } from "./StrategyApiClient";
import { StrategyRuleNode } from "./StrategyRuleNode";
import { newCondition } from "./strategyRuleTree";

const api = new StrategyApiClient();
const freshDefinition = (): StrategyDefinitionV1 => ({
  schemaVersion: 1, name: "New strategy",
  entry: { all: [newCondition("RSI")] },
  exit: { all: [{ indicator: "RSI", period: 14, operator: "GTE", value: 80 }] },
});

export default function PageBot() {
  const [strategies, setStrategies] = useState<StrategyDto[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [name, setName] = useState("New strategy");
  const [description, setDescription] = useState("");
  const [definition, setDefinition] = useState<StrategyDefinitionV1>(freshDefinition);
  const [issues, setIssues] = useState<StrategyValidationIssue[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setStrategies(await api.list()); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not load strategies"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const selectStrategy = (id: string) => {
    setSelectedId(id); setIssues([]); setMessage("");
    const selected = strategies.find((strategy) => strategy.id === id);
    if (!selected) { setName("New strategy"); setDescription(""); setDefinition(freshDefinition()); return; }
    const latest = [...selected.versions].sort((a, b) => b.version - a.version)[0];
    setName(selected.name); setDescription(selected.description);
    setDefinition(structuredClone(latest.definition));
  };

  const normalizedDefinition = useMemo(() => ({ ...definition, name: name.trim() }), [definition, name]);
  const validate = async () => {
    setBusy(true); setMessage("");
    try {
      const result = await api.validate(normalizedDefinition);
      setIssues(result.issues);
      setMessage(result.valid ? "Strategy definition is valid." : "Fix the highlighted validation issues before saving.");
      return result.valid;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Validation failed"); return false; }
    finally { setBusy(false); }
  };

  const save = async () => {
    setBusy(true); setMessage("");
    try {
      const validation = await api.validate(normalizedDefinition);
      setIssues(validation.issues);
      if (!validation.valid) { setMessage("The strategy is invalid and was not saved."); return; }
      if (selectedId) {
        const version = await api.addVersion(selectedId, normalizedDefinition);
        setMessage(`Version ${version.version} saved.`);
      } else {
        const created = await api.create(name.trim(), description.trim(), normalizedDefinition);
        setSelectedId(created.id); setMessage("Strategy and version 1 saved.");
      }
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save strategy"); }
    finally { setBusy(false); }
  };

  return <div className="mx-auto max-w-7xl text-slate-100">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">Trading bot</p>
        <h2 className="mt-1 text-3xl font-bold">Strategy rule builder</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">Build a versioned strategy without executable code. The form and JSON preview use the same validated format.</p>
      </div>
      <button type="button" className="rounded-xl border border-cyan-600 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-950"
        onClick={() => selectStrategy("")}>+ New strategy</button>
    </div>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-5">
        <div className="grid gap-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-slate-300">Strategy
            <select className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2" value={selectedId}
              onChange={(event) => selectStrategy(event.target.value)}>
              <option value="">New strategy</option>
              {strategies.map((strategy) => <option key={strategy.id} value={strategy.id}>{strategy.name} · v{strategy.versions.at(-1)?.version ?? 1}</option>)}
            </select></label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">Name
            <input className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2" value={name}
              onChange={(event) => setName(event.target.value)} maxLength={120} /></label>
          <label className="flex flex-col gap-2 text-sm text-slate-300 md:col-span-2">Description
            <textarea className="min-h-20 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2" value={description}
              onChange={(event) => setDescription(event.target.value)} /></label>
        </div>

        <div><h3 className="mb-2 text-lg font-semibold text-emerald-300">Entry conditions</h3>
          <StrategyRuleNode condition={definition.entry} root={definition.entry} path={[]} label="Entry root"
            onChange={(entry) => setDefinition((current) => ({ ...current, entry }))} /></div>
        <div><h3 className="mb-2 text-lg font-semibold text-rose-300">Exit conditions</h3>
          <StrategyRuleNode condition={definition.exit} root={definition.exit} path={[]} label="Exit root"
            onChange={(exit) => setDefinition((current) => ({ ...current, exit }))} /></div>
      </section>

      <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
          <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">JSON preview</h3>
            <span className="rounded-full bg-cyan-950 px-2 py-1 text-xs text-cyan-300">schema v1</span></div>
          <pre className="max-h-[560px] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-3 text-xs leading-5 text-slate-300">{JSON.stringify(normalizedDefinition, null, 2)}</pre>
        </div>
        {issues.length > 0 && <div className="rounded-2xl border border-rose-800 bg-rose-950/40 p-4">
          <h3 className="font-semibold text-rose-200">Validation issues</h3>
          <ul className="mt-2 space-y-2 text-xs text-rose-100">{issues.map((issue, index) =>
            <li key={`${issue.path}-${index}`}><code className="text-rose-300">{issue.path}</code> — {issue.message}</li>)}</ul>
        </div>}
        {message && <div role="status" className="rounded-xl border border-slate-600 bg-slate-800 p-3 text-sm text-slate-200">{message}</div>}
        <div className="grid grid-cols-2 gap-3">
          <button type="button" disabled={busy} onClick={() => void validate()}
            className="rounded-xl border border-slate-500 px-4 py-3 font-semibold hover:border-cyan-400 disabled:opacity-50">Validate</button>
          <button type="button" disabled={busy} onClick={() => void save()}
            className="rounded-xl bg-cyan-700 px-4 py-3 font-semibold hover:bg-cyan-600 disabled:opacity-50">{selectedId ? "Save new version" : "Create strategy"}</button>
        </div>
      </aside>
    </div>
  </div>;
}
