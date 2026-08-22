"use client";

import type { StrategyCondition } from "@/src/modules/strategy/domain/StrategyDefinition";
import { appendCondition, CONDITION_KIND_OPTIONS, conditionKind, GROUP_CHILD_KINDS,
  newCondition, removeCondition, replaceCondition, type ConditionKind } from "./strategyRuleTree";
const inputClass = "rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400";

type Props = {
  condition: StrategyCondition;
  root: StrategyCondition;
  path: number[];
  label: string;
  onChange: (value: StrategyCondition) => void;
  removable?: boolean;
  positionConditionsAllowed?: boolean;
};

export function StrategyRuleNode({ condition, root, path, label, onChange, removable = false,
  positionConditionsAllowed = false }: Props) {
  const kind = conditionKind(condition);
  const replace = (value: StrategyCondition) => onChange(replaceCondition(root, path, value));
  const groupChildren = "all" in condition ? condition.all : "any" in condition ? condition.any : null;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-20 text-xs font-semibold uppercase tracking-widest text-cyan-300">{label}</span>
        <select aria-label={`${label} rule type`} className={inputClass} value={kind}
          onChange={(event) => replace(newCondition(event.target.value as ConditionKind))}>
          {CONDITION_KIND_OPTIONS.filter((item) => positionConditionsAllowed ||
            !["POSITION_RETURN_PCT", "TRAILING_RETURN_PCT"].includes(item.value))
            .map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        {removable && <button type="button" className="ml-auto rounded-lg border border-rose-700 px-3 py-2 text-xs text-rose-200 hover:bg-rose-950"
          onClick={() => onChange(removeCondition(root, path))}>Remove</button>}
      </div>

      {groupChildren && <div className="mt-4 space-y-3 border-l-2 border-cyan-800 pl-4">
        {groupChildren.map((child, index) => <StrategyRuleNode key={`${path.join("-")}-${index}`}
          condition={child} root={root} path={[...path, index]} label={`Rule ${index + 1}`}
          onChange={onChange} removable={groupChildren.length > 1}
          positionConditionsAllowed={positionConditionsAllowed} />)}
        <div className="flex flex-wrap gap-2 pt-1">
          {GROUP_CHILD_KINDS
            .filter((childKind) => positionConditionsAllowed ||
              !["POSITION_RETURN_PCT", "TRAILING_RETURN_PCT"].includes(childKind)).map((childKind) =>
            <button type="button" key={childKind}
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:border-cyan-500 hover:text-cyan-200"
              onClick={() => onChange(appendCondition(root, path, newCondition(childKind)))}>
              + {CONDITION_KIND_OPTIONS.find((item) => item.value === childKind)?.label}
            </button>)}
        </div>
      </div>}

      {"indicator" in condition && condition.indicator === "RSI" && <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label="Period"><input className={inputClass} type="number" min={1} step={1} value={condition.period}
          onChange={(event) => replace({ ...condition, period: Number(event.target.value) })} /></Field>
        <Field label="Operator"><select className={inputClass} value={condition.operator}
          onChange={(event) => replace({ ...condition, operator: event.target.value as typeof condition.operator })}>
          {(["LT", "LTE", "GT", "GTE", "CROSS_ABOVE", "CROSS_BELOW"] as const)
            .map((operator) => <option key={operator}>{operator}</option>)}
        </select></Field>
        <Field label="RSI threshold"><input className={inputClass} type="number" min={0} max={100} step="any" value={condition.value}
          onChange={(event) => replace({ ...condition, value: Number(event.target.value) })} /></Field>
        <p className="text-xs text-slate-500 sm:col-span-3">CROSS_ABOVE matches only when RSI moves from at or below the threshold to above it; CROSS_BELOW matches the opposite move.</p>
      </div>}

      {"indicator" in condition && condition.indicator === "EMA_DISTANCE" && <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label="EMA period"><input className={inputClass} type="number" min={1} step={1} value={condition.period}
          onChange={(event) => replace({ ...condition, period: Number(event.target.value) })} /></Field>
        <Field label="Close position"><select className={inputClass} value={condition.position}
          onChange={(event) => replace({ ...condition, position: event.target.value as typeof condition.position })}>
          <option value="ABOVE">Above EMA</option><option value="BELOW">Below EMA</option>
        </select></Field>
        <Field label="Maximum distance % (optional)">
          <div className="flex items-center gap-2">
            <input aria-label="Limit EMA distance" type="checkbox" checked={condition.maximumDistancePct !== undefined}
              onChange={(event) => replace(event.target.checked
                ? { ...condition, maximumDistancePct: 2 }
                : (({ maximumDistancePct: _removed, ...rest }) => rest)(condition))} />
            <input className={`${inputClass} min-w-0 flex-1`} type="number" min={0} max={100} step="0.1"
              disabled={condition.maximumDistancePct === undefined}
              value={condition.maximumDistancePct ?? ""}
              onChange={(event) => replace({ ...condition, maximumDistancePct: Number(event.target.value) })} />
          </div>
        </Field>
        <p className="text-xs text-slate-500 sm:col-span-3">The last closed candle must be strictly above or below the EMA. Leave the distance limit off to accept any distance.</p>
      </div>}

      {"indicator" in condition && condition.indicator === "EMA_DEVIATION_PCT" &&
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Field label="EMA period"><input className={inputClass} type="number" min={1} step={1}
            value={condition.period}
            onChange={(event) => replace({ ...condition, period: Number(event.target.value) })} /></Field>
          <Field label="Operator"><select className={inputClass} value={condition.operator}
            onChange={(event) => replace({ ...condition, operator: event.target.value as typeof condition.operator })}>
            {(["LT", "LTE", "GT", "GTE"] as const).map((operator) => <option key={operator}>{operator}</option>)}
          </select></Field>
          <Field label="Signed deviation threshold %"><input className={inputClass} type="number" step="0.1"
            value={condition.value}
            onChange={(event) => replace({ ...condition, value: Number(event.target.value) })} /></Field>
          <p className="text-xs text-slate-500 sm:col-span-3">Deviation is (close − EMA) / EMA × 100. Negative values are below EMA; positive values are above it. For example, LTE −2 matches at least 2% below EMA.</p>
        </div>}

      {"indicator" in condition && condition.indicator === "EMA_CROSS_CONFIRMATION" && <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label="EMA period"><input className={inputClass} type="number" min={1} step={1} value={condition.period}
          onChange={(event) => replace({ ...condition, period: Number(event.target.value) })} /></Field>
        <Field label="Crossing direction"><select className={inputClass} value={condition.direction}
          onChange={(event) => replace({ ...condition, direction: event.target.value as typeof condition.direction })}>
          <option value="ABOVE">Above EMA</option><option value="BELOW">Below EMA</option>
        </select></Field>
        <Field label="Confirmation candles"><input className={inputClass} type="number" min={1} step={1}
          value={condition.confirmationCandles}
          onChange={(event) => replace({ ...condition, confirmationCandles: Number(event.target.value) })} /></Field>
        <p className="text-xs text-slate-500 sm:col-span-3">Matches once when the selected number of closes are strictly on the chosen side of their own EMA, immediately after a close on the opposite side.</p>
      </div>}

      {"indicator" in condition && condition.indicator === "MARKET_REGIME" &&
        <div className="mt-4 grid gap-3 sm:grid-cols-1">
          <Field label="Required regime"><select className={inputClass} value={condition.value}
            onChange={(event) => replace({ ...condition, value: event.target.value as typeof condition.value })}>
            {(["BULLISH", "BEARISH", "SIDEWAYS"] as const).map((value) => <option key={value}>{value}</option>)}
          </select></Field>
          <p className="text-xs text-slate-500">Bullish means EMA7 &gt; EMA25 &gt; EMA100; bearish is the reverse ordering. Every other ordering is sideways.</p>
        </div>}

      {"indicator" in condition && condition.indicator === "EMA_SLOPE" &&
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Field label="EMA period"><input className={inputClass} type="number" min={1} step={1}
            value={condition.period} onChange={(event) => replace({ ...condition, period: Number(event.target.value) })} /></Field>
          <Field label="Lookback candles"><input className={inputClass} type="number" min={1} step={1}
            value={condition.lookbackCandles}
            onChange={(event) => replace({ ...condition, lookbackCandles: Number(event.target.value) })} /></Field>
          <Field label="Operator"><select className={inputClass} value={condition.operator}
            onChange={(event) => replace({ ...condition, operator: event.target.value as typeof condition.operator })}>
            {(["LT", "LTE", "GT", "GTE"] as const).map((operator) => <option key={operator}>{operator}</option>)}
          </select></Field>
          <Field label="Slope threshold %"><input className={inputClass} type="number" step="0.1"
            value={condition.value} onChange={(event) => replace({ ...condition, value: Number(event.target.value) })} /></Field>
          <p className="text-xs text-slate-500 sm:col-span-4">Signed EMA percentage change over the selected candle lookback. Positive values mean the EMA rose.</p>
        </div>}

      {"indicator" in condition && condition.indicator === "POSITION_RETURN_PCT" &&
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Operator"><select className={inputClass} value={condition.operator}
            onChange={(event) => replace({ ...condition, operator: event.target.value as typeof condition.operator })}>
            {(["LT", "LTE", "GT", "GTE"] as const).map((operator) => <option key={operator}>{operator}</option>)}
          </select></Field>
          <Field label="Signed net return %"><input className={inputClass} type="number" step="0.1"
            value={condition.value}
            onChange={(event) => replace({ ...condition, value: Number(event.target.value) })} /></Field>
          <p className="text-xs text-slate-500 sm:col-span-2">Exit-only condition. Return includes entry fees and the estimated exit fee. Combine GTE take-profit and LTE stop-loss rules inside an Any group.</p>
        </div>}

      {"indicator" in condition && condition.indicator === "TRAILING_RETURN_PCT" &&
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Field label="Activation %"><input className={inputClass} type="number" step="0.1"
            value={condition.activationPct}
            onChange={(event) => replace({ ...condition, activationPct: Number(event.target.value) })} /></Field>
          <Field label="Minimum exit %"><input className={inputClass} type="number" step="0.1"
            value={condition.minimumExitPct}
            onChange={(event) => replace({ ...condition, minimumExitPct: Number(event.target.value) })} /></Field>
          <Field label="Trailing distance %"><input className={inputClass} type="number" min="0.1" step="0.1"
            value={condition.trailingDistancePct}
            onChange={(event) => replace({ ...condition, trailingDistancePct: Number(event.target.value) })} /></Field>
          <p className="text-xs text-slate-500 sm:col-span-3">Exit-only, fee-aware condition. Trailing activates only after the lot reaches the activation level on a closed-candle close.</p>
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
