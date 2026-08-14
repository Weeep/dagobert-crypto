export const STRATEGY_SCHEMA_VERSION = 1 as const;
export const MAX_STRATEGY_DEPTH = 10;
export const MAX_STRATEGY_NODES = 100;

export type ComparisonOperator = "LT" | "LTE" | "GT" | "GTE";
export type RsiCondition = { indicator: "RSI"; period: number; operator: ComparisonOperator; value: number };
export type EmaDistanceCondition = { indicator: "EMA_DISTANCE"; period: number; operator: "ABS_LTE"; value: number };
export type CandleSequenceCondition = {
  candleSequence: { count: number; direction: "RED" | "GREEN" | "DOJI"; minimumBodyChangePct: number };
};
export type StrategyCondition =
  | { all: StrategyCondition[] }
  | { any: StrategyCondition[] }
  | RsiCondition
  | EmaDistanceCondition
  | CandleSequenceCondition;

export type StrategyDefinitionV1 = {
  schemaVersion: typeof STRATEGY_SCHEMA_VERSION;
  name: string;
  entry: StrategyCondition;
  exit: StrategyCondition;
};

export type StrategyValidationIssue = { path: string; code: string; message: string };
export type StrategyValidationResult =
  | { ok: true; definition: StrategyDefinitionV1; issues: [] }
  | { ok: false; definition: null; issues: StrategyValidationIssue[] };

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, expected: readonly string[]) =>
  Object.keys(value).length === expected.length && Object.keys(value).every((key) => expected.includes(key));
const positiveInteger = (value: unknown) => Number.isSafeInteger(value) && (value as number) > 0;
const nonNegativeNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0;

export function validateStrategyDefinition(value: unknown, declaredSchemaVersion = 1): StrategyValidationResult {
  const issues: StrategyValidationIssue[] = [];
  const issue = (path: string, code: string, message: string) => issues.push({ path, code, message });
  if (declaredSchemaVersion !== STRATEGY_SCHEMA_VERSION) {
    issue("$.schemaVersion", "UNSUPPORTED_SCHEMA_VERSION", `schema version ${declaredSchemaVersion} is not supported`);
    return { ok: false, definition: null, issues };
  }
  if (!object(value)) {
    issue("$", "TYPE", "strategy definition must be an object");
    return { ok: false, definition: null, issues };
  }
  if (!exactKeys(value, ["schemaVersion", "name", "entry", "exit"]))
    issue("$", "PROPERTIES", "strategy definition must contain only schemaVersion, name, entry, and exit");
  if (value.schemaVersion !== STRATEGY_SCHEMA_VERSION)
    issue("$.schemaVersion", "UNSUPPORTED_SCHEMA_VERSION", "schemaVersion must be 1");
  if (typeof value.name !== "string" || value.name.trim().length === 0 || value.name.length > 120)
    issue("$.name", "VALUE", "name must be a non-empty string of at most 120 characters");

  let nodes = 0;
  const condition = (candidate: unknown, path: string, depth: number): void => {
    nodes += 1;
    if (nodes > MAX_STRATEGY_NODES) { issue(path, "MAX_NODES", `strategy cannot exceed ${MAX_STRATEGY_NODES} conditions`); return; }
    if (depth > MAX_STRATEGY_DEPTH) { issue(path, "MAX_DEPTH", `condition nesting cannot exceed ${MAX_STRATEGY_DEPTH}`); return; }
    if (!object(candidate)) { issue(path, "TYPE", "condition must be an object"); return; }
    if ("all" in candidate || "any" in candidate) {
      const key = "all" in candidate ? "all" : "any";
      if (!exactKeys(candidate, [key])) issue(path, "PROPERTIES", `${key} condition cannot contain other properties`);
      const children = candidate[key];
      if (!Array.isArray(children) || children.length === 0) { issue(`${path}.${key}`, "VALUE", `${key} must be a non-empty array`); return; }
      children.forEach((child, index) => condition(child, `${path}.${key}[${index}]`, depth + 1));
      return;
    }
    if ("indicator" in candidate) {
      if (!exactKeys(candidate, ["indicator", "period", "operator", "value"]))
        issue(path, "PROPERTIES", "indicator condition contains unsupported properties");
      if (!positiveInteger(candidate.period)) issue(`${path}.period`, "VALUE", "period must be a positive safe integer");
      if (!nonNegativeNumber(candidate.value)) issue(`${path}.value`, "VALUE", "value must be a non-negative finite number");
      if (candidate.indicator === "RSI") {
        if (typeof candidate.value === "number" && candidate.value > 100)
          issue(`${path}.value`, "VALUE", "RSI value cannot exceed 100");
        if (!["LT", "LTE", "GT", "GTE"].includes(candidate.operator as string))
          issue(`${path}.operator`, "UNSUPPORTED_OPERATOR", "RSI supports LT, LTE, GT, and GTE");
      } else if (candidate.indicator === "EMA_DISTANCE") {
        if (candidate.operator !== "ABS_LTE")
          issue(`${path}.operator`, "UNSUPPORTED_OPERATOR", "EMA_DISTANCE supports only ABS_LTE");
      } else issue(`${path}.indicator`, "UNSUPPORTED_INDICATOR", "indicator is not supported");
      return;
    }
    if ("candleSequence" in candidate) {
      if (!exactKeys(candidate, ["candleSequence"]) || !object(candidate.candleSequence)) {
        issue(path, "PROPERTIES", "candleSequence condition is malformed"); return;
      }
      const sequence = candidate.candleSequence;
      if (!exactKeys(sequence, ["count", "direction", "minimumBodyChangePct"]))
        issue(`${path}.candleSequence`, "PROPERTIES", "candleSequence contains unsupported properties");
      if (!positiveInteger(sequence.count)) issue(`${path}.candleSequence.count`, "VALUE", "count must be a positive safe integer");
      if (!["RED", "GREEN", "DOJI"].includes(sequence.direction as string))
        issue(`${path}.candleSequence.direction`, "VALUE", "direction must be RED, GREEN, or DOJI");
      if (!nonNegativeNumber(sequence.minimumBodyChangePct))
        issue(`${path}.candleSequence.minimumBodyChangePct`, "VALUE", "minimumBodyChangePct must be non-negative and finite");
      return;
    }
    issue(path, "CONDITION", "condition type is not supported");
  };
  condition(value.entry, "$.entry", 1);
  condition(value.exit, "$.exit", 1);
  return issues.length === 0
    ? { ok: true, definition: value as StrategyDefinitionV1, issues: [] }
    : { ok: false, definition: null, issues };
}
