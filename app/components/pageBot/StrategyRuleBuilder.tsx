import type { StrategyDto } from "@/src/modules/strategy/dto/StrategyDto";
import { validateStrategyDefinition, type StrategyDefinitionV1, type StrategyValidationIssue } from "@/src/modules/strategy/domain/StrategyDefinition";
import { StrategyRuleNode } from "./StrategyRuleNode";

const input = "w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-500";

type Props = {
  definition: StrategyDefinitionV1; onChange: (definition: StrategyDefinitionV1) => void;
  json: string; onJsonChange: (json: string) => void; jsonError: string;
  strategies?: StrategyDto[]; selectedId?: string; onSelect?: (id: string) => void;
  description?: string; onDescriptionChange?: (value: string) => void;
  issues?: StrategyValidationIssue[]; sideBySide?: boolean;
};

export function StrategyRuleBuilder({ definition, onChange, json, onJsonChange, jsonError, strategies,
  selectedId = "", onSelect, description = "", onDescriptionChange, issues = [], sideBySide = false }: Props) {
  const form = <div className="min-w-0 space-y-5">
    <section className="grid gap-4 rounded-2xl border border-slate-700 bg-slate-900 p-4 sm:p-5 md:grid-cols-2">
      {strategies && onSelect && <label className="flex flex-col gap-2 text-sm text-slate-300">Existing strategy<select className={input} value={selectedId} onChange={(e) => onSelect(e.target.value)}><option value="">New strategy</option>{strategies.filter((s) => !s.archivedAt || s.id === selectedId).map((strategy) => <option key={strategy.id} value={strategy.id}>{strategy.name} · v{strategy.versions.at(-1)?.version ?? 1}</option>)}</select></label>}
      <label className="flex flex-col gap-2 text-sm text-slate-300">Strategy name<input className={input} value={definition.name} onChange={(e) => onChange({ ...definition, name: e.target.value })} /></label>
      {onDescriptionChange && <label className="flex flex-col gap-2 text-sm text-slate-300 md:col-span-2">Description<textarea className={`${input} min-h-20`} value={description} onChange={(e) => onDescriptionChange(e.target.value)} /></label>}
    </section>
    <section className="rounded-2xl border border-emerald-900/70 bg-slate-900 p-4 sm:p-5"><h3 className="font-semibold text-emerald-300">Entry trigger policy</h3><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="flex flex-col gap-2 text-sm">Trigger<select className={input} value={definition.entryPolicy?.trigger ?? "EVERY_MATCHING_CANDLE"} onChange={(e) => onChange({ ...definition, entryPolicy: { trigger: e.target.value as "EVERY_MATCHING_CANDLE" | "ON_FALSE_TO_TRUE", cooldownCandles: definition.entryPolicy?.cooldownCandles ?? 0 } })}><option value="ON_FALSE_TO_TRUE">Once per matching episode</option><option value="EVERY_MATCHING_CANDLE">Every matching candle</option></select></label><label className="flex flex-col gap-2 text-sm">Cooldown candles<input className={input} type="number" min={0} value={definition.entryPolicy?.cooldownCandles ?? 0} onChange={(e) => onChange({ ...definition, entryPolicy: { trigger: definition.entryPolicy?.trigger ?? "ON_FALSE_TO_TRUE", cooldownCandles: Math.max(0, Math.trunc(Number(e.target.value) || 0)) } })} /></label></div></section>
    <div><h3 className="mb-2 font-semibold text-emerald-300">Entry conditions</h3><StrategyRuleNode condition={definition.entry} root={definition.entry} path={[]} label="Entry root" onChange={(entry) => onChange({ ...definition, entry })} /></div>
    <div><h3 className="mb-2 font-semibold text-rose-300">Exit conditions</h3><StrategyRuleNode condition={definition.exit} root={definition.exit} path={[]} label="Exit root" positionConditionsAllowed onChange={(exit) => onChange({ ...definition, exit })} /></div>
  </div>;
  const jsonPanel = <aside className={sideBySide ? "min-w-0 xl:sticky xl:top-4 xl:self-start" : "min-w-0"}><section className="rounded-2xl border border-cyan-900 bg-slate-900 p-4"><div className="mb-2 flex justify-between gap-3"><h3 className="font-semibold">Editable JSON</h3><span className="text-xs text-cyan-300">schema v1</span></div><textarea aria-label="Editable strategy JSON" spellCheck={false} value={json} onChange={(e) => onJsonChange(e.target.value)} className={`${input} min-h-80 resize-y font-mono text-xs leading-5 xl:min-h-[34rem]`} />{jsonError && <p role="alert" className="mt-2 text-xs text-rose-300">{jsonError}</p>}{issues.length > 0 && <div className="mt-3 space-y-1 text-xs text-rose-200">{issues.map((issue, index) => <p key={`${issue.path}-${index}`}><code>{issue.path}</code> — {issue.message}</p>)}</div>}</section></aside>;
  return <div className={sideBySide ? "grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,40%)]" : "min-w-0 space-y-5"}>{form}{jsonPanel}</div>;
}

export function parseStrategyJson(value: string) {
  try { const parsed: unknown = JSON.parse(value); const validation = validateStrategyDefinition(parsed);
    return validation.ok ? { definition: validation.definition, error: "", issues: [] } : { definition: null, error: "The JSON is syntactically valid but is not a valid strategy.", issues: validation.issues };
  } catch { return { definition: null, error: "The JSON is not valid yet. Fix its syntax to update the visual builder.", issues: [] }; }
}
