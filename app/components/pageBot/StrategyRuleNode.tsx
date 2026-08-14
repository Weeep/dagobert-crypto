"use client";

import type { StrategyCondition } from "@/src/modules/strategy/domain/StrategyDefinition";
import { appendCondition, conditionKind, newCondition, removeCondition,
  replaceCondition, type ConditionKind } from "./strategyRuleTree";

const kinds: Array<{ value: ConditionKind; label: string }> = [
  { value: "ALL", label: "All conditions" }, { value: "ANY", label: "Any condition" },
  { value: "RSI", label: "RSI" }, { value: "EMA_DISTANCE", label: "EMA distance" },
  { value: "CANDLE_SEQUENCE", label: "Candle sequence" },
];
const inputClass = "rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400";

type Props = {
  condition: StrategyCondition;
  root: StrategyCondition;
  path: number[];
  label: string;
  onChange: (value: StrategyCondition) => void;
  removable?: boolean;
};

export function StrategyRuleNode({ condition, root, path, label, onChange, removable = false }: Props) {
  const kind = conditionKind(condition);
  const replace = (value: StrategyCondition) => onChange(replaceCondition(root, path, value));
  const groupChildren = "all" in condition ? condition.all : "any" in condition ? condition.any : null;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-20 text-xs font-semibold uppercase tracking-widest text-cyan-300">{label}</span>
        <select aria-label={`${label} rule type`} className={inputClass} value={kind}
          onChange={(event) => replace(newCondition(event.target.value as ConditionKind))}>
          {kinds.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        {removable && <button type="button" className="ml-auto rounded-lg border border-rose-700 px-3 py-2 text-xs text-rose-200 hover:bg-rose-950"
          onClick={() => onChange(removeCondition(root, path))}>Remove</button>}
      </div>

      {groupChildren && <div className="mt-4 space-y-3 border-l-2 border-cyan-800 pl-4">
        {groupChildren.map((child, index) => <StrategyRuleNode key={`${path.join("-")}-${index}`}
          condition={child} root={root} path={[...path, index]} label={`Rule ${index + 1}`}
          onChange={onChange} removable={groupChildren.length > 1} />)}
        <div className="flex flex-wrap gap-2 pt-1">
          {(["RSI", "EMA_DISTANCE", "CANDLE_SEQUENCE", "ALL", "ANY"] as ConditionKind[]).map((childKind) =>
            <button type="button" key={childKind}
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:border-cyan-500 hover:text-cyan-200"
              onClick={() => onChange(appendCondition(root, path, newCondition(childKind)))}>
              + {kinds.find((item) => item.value === childKind)?.label}
            </button>)}
        </div>
      </div>}

      {"indicator" in condition && condition.indicator === "RSI" && <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label="Period"><input className={inputClass} type="number" min={1} step={1} value={condition.period}
          onChange={(event) => replace({ ...condition, period: Number(event.target.value) })} /></Field>
        <Field label="Operator"><select className={inputClass} value={condition.operator}
          onChange={(event) => replace({ ...condition, operator: event.target.value as typeof condition.operator })}>
          {(["LT", "LTE", "GT", "GTE"] as const).map((operator) => <option key={operator}>{operator}</option>)}
        </select></Field>
        <Field label="RSI threshold"><input className={inputClass} type="number" min={0} max={100} step="any" value={condition.value}
          onChange={(event) => replace({ ...condition, value: Number(event.target.value) })} /></Field>
      </div>}

      {"indicator" in condition && condition.indicator === "EMA_DISTANCE" && <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="EMA period"><input className={inputClass} type="number" min={1} step={1} value={condition.period}
          onChange={(event) => replace({ ...condition, period: Number(event.target.value) })} /></Field>
        <Field label="Maximum absolute distance"><input className={inputClass} type="number" min={0} step="0.001" value={condition.value}
          onChange={(event) => replace({ ...condition, value: Number(event.target.value) })} /></Field>
      </div>}

      {"candleSequence" in condition && <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label="Candle count"><input className={inputClass} type="number" min={1} step={1} value={condition.candleSequence.count}
          onChange={(event) => replace({ candleSequence: { ...condition.candleSequence, count: Number(event.target.value) } })} /></Field>
        <Field label="Direction"><select className={inputClass} value={condition.candleSequence.direction}
          onChange={(event) => replace({ candleSequence: { ...condition.candleSequence,
            direction: event.target.value as typeof condition.candleSequence.direction } })}>
          {(["RED", "GREEN", "DOJI"] as const).map((direction) => <option key={direction}>{direction}</option>)}
        </select></Field>
        <Field label="Minimum body change %"><input className={inputClass} type="number" min={0} step="0.1"
          value={condition.candleSequence.minimumBodyChangePct}
          onChange={(event) => replace({ candleSequence: { ...condition.candleSequence,
            minimumBodyChangePct: Number(event.target.value) } })} /></Field>
      </div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1 text-xs font-medium text-slate-400">
    {label}{children}
  </label>;
}
