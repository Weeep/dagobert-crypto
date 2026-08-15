import type { ConditionEvaluation } from "@/src/modules/strategy";

const numeric = (value: string | number | boolean | null | string[] | undefined) => {
  if (typeof value === "number") return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return value === null || value === undefined ? "—" : String(value);
};
const comparison = (operator: unknown) => ({ LT: "<", LTE: "≤", GT: ">", GTE: "≥" }[String(operator)] ?? String(operator));

export function conditionObservationSummaries(evaluation: ConditionEvaluation): string[] {
  if (evaluation.children.length > 0) return evaluation.children.flatMap(conditionObservationSummaries);
  const values = evaluation.observedValues;
  if (evaluation.reasonCode === "INSUFFICIENT_HISTORY")
    return [`${evaluation.type}: insufficient history (${numeric(values.availableCandles)}/${numeric(values.requiredCandles)} candles)`];
  if (evaluation.type === "RSI")
    return [`RSI(${numeric(values.period)}): ${numeric(values.observed)} · condition ${comparison(values.operator)} ${numeric(values.expected)} · ${evaluation.matched ? "matched" : "not matched"}`];
  if (evaluation.type === "EMA_DISTANCE") {
    const distance = values.distancePct === null ? "—" : `${numeric(values.distancePct)}%`;
    return [`Close ${numeric(values.close)} · EMA(${numeric(values.period)}): ${numeric(values.ema)} · ${numeric(values.position)} · distance ${distance} · ${evaluation.matched ? "matched" : "not matched"}`];
  }
  if (evaluation.type === "CANDLE_SEQUENCE")
    return [`Last ${numeric(values.count)} candles: ${numeric(values.directions)} · expected ${numeric(values.expectedDirection)} · ${evaluation.matched ? "matched" : "not matched"}`];
  return [evaluation.explanation];
}
