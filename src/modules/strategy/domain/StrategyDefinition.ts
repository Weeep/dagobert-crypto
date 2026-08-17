export const STRATEGY_SCHEMA_VERSION = 1 as const;
export const MAX_STRATEGY_DEPTH = 10;
export const MAX_STRATEGY_NODES = 100;

export type ComparisonOperator = "LT" | "LTE" | "GT" | "GTE";
export type EntryTrigger = "EVERY_MATCHING_CANDLE" | "ON_FALSE_TO_TRUE";
export type EntryPolicy = { trigger: EntryTrigger; cooldownCandles?: number };
export type RsiCondition = { indicator: "RSI"; period: number; operator: ComparisonOperator; value: number };
export type PositionReturnPctCondition = {
  indicator: "POSITION_RETURN_PCT";
  operator: ComparisonOperator;
  value: number;
};
export type EmaPosition = "ABOVE" | "BELOW";
export type EmaDistanceCondition = {
  indicator: "EMA_DISTANCE";
  period: number;
  position: EmaPosition;
  maximumDistancePct?: number;
};
export type EmaDeviationPctCondition = {
  indicator: "EMA_DEVIATION_PCT";
  period: number;
  operator: ComparisonOperator;
  value: number;
};
export type EmaCrossConfirmationCondition = {
  indicator: "EMA_CROSS_CONFIRMATION";
  period: number;
  direction: EmaPosition;
  confirmationCandles: number;
};
export type MarketRegime = "BULLISH" | "BEARISH" | "SIDEWAYS";
export type MarketRegimeCondition = { indicator: "MARKET_REGIME"; value: MarketRegime };
export type EmaSlopeCondition = {
  indicator: "EMA_SLOPE";
  period: number;
  lookbackCandles: number;
  operator: ComparisonOperator;
  value: number;
};
export type CandleSequenceCondition = {
  candleSequence: { count: number; direction: "RED" | "GREEN" | "DOJI"; minimumBodyChangePct: number };
};
export type StrategyCondition =
  | { all: StrategyCondition[] }
  | { any: StrategyCondition[] }
  | RsiCondition
  | PositionReturnPctCondition
  | EmaDistanceCondition
  | EmaDeviationPctCondition
  | EmaCrossConfirmationCondition
  | MarketRegimeCondition
  | EmaSlopeCondition
  | CandleSequenceCondition;

export type StrategyDefinitionV1 = {
  schemaVersion: typeof STRATEGY_SCHEMA_VERSION;
  name: string;
  entry: StrategyCondition;
  exit: StrategyCondition;
  entryPolicy?: EntryPolicy;
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
const percentageWithAtMostOneDecimal = (value: unknown) => nonNegativeNumber(value) &&
  (value as number) <= 100 && Math.abs((value as number) * 10 - Math.round((value as number) * 10)) < 1e-9;

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
  const definitionKeys = value.entryPolicy === undefined
    ? ["schemaVersion", "name", "entry", "exit"] : ["schemaVersion", "name", "entry", "exit", "entryPolicy"];
  if (!exactKeys(value, definitionKeys))
    issue("$", "PROPERTIES", "strategy definition contains unsupported properties");
  if (value.schemaVersion !== STRATEGY_SCHEMA_VERSION)
    issue("$.schemaVersion", "UNSUPPORTED_SCHEMA_VERSION", "schemaVersion must be 1");
  if (typeof value.name !== "string" || value.name.trim().length === 0 || value.name.length > 120)
    issue("$.name", "VALUE", "name must be a non-empty string of at most 120 characters");
  if (value.entryPolicy !== undefined) {
    if (!object(value.entryPolicy)) issue("$.entryPolicy", "TYPE", "entryPolicy must be an object");
    else {
      const keys = value.entryPolicy.cooldownCandles === undefined ? ["trigger"] : ["trigger", "cooldownCandles"];
      if (!exactKeys(value.entryPolicy, keys)) issue("$.entryPolicy", "PROPERTIES", "entryPolicy contains unsupported properties");
      if (!["EVERY_MATCHING_CANDLE", "ON_FALSE_TO_TRUE"].includes(value.entryPolicy.trigger as string))
        issue("$.entryPolicy.trigger", "VALUE", "entryPolicy trigger is unsupported");
      if (value.entryPolicy.cooldownCandles !== undefined &&
          (!Number.isSafeInteger(value.entryPolicy.cooldownCandles) || (value.entryPolicy.cooldownCandles as number) < 0))
        issue("$.entryPolicy.cooldownCandles", "VALUE", "cooldownCandles must be a non-negative safe integer");
    }
  }

  let nodes = 0;
  const condition = (candidate: unknown, path: string, depth: number, positionConditionsAllowed: boolean): void => {
    nodes += 1;
    if (nodes > MAX_STRATEGY_NODES) { issue(path, "MAX_NODES", `strategy cannot exceed ${MAX_STRATEGY_NODES} conditions`); return; }
    if (depth > MAX_STRATEGY_DEPTH) { issue(path, "MAX_DEPTH", `condition nesting cannot exceed ${MAX_STRATEGY_DEPTH}`); return; }
    if (!object(candidate)) { issue(path, "TYPE", "condition must be an object"); return; }
    if ("all" in candidate || "any" in candidate) {
      const key = "all" in candidate ? "all" : "any";
      if (!exactKeys(candidate, [key])) issue(path, "PROPERTIES", `${key} condition cannot contain other properties`);
      const children = candidate[key];
      if (!Array.isArray(children) || children.length === 0) { issue(`${path}.${key}`, "VALUE", `${key} must be a non-empty array`); return; }
      children.forEach((child, index) => condition(child, `${path}.${key}[${index}]`, depth + 1, positionConditionsAllowed));
      return;
    }
    if ("indicator" in candidate) {
      if (candidate.indicator === "RSI") {
        if (!positiveInteger(candidate.period)) issue(`${path}.period`, "VALUE", "period must be a positive safe integer");
        if (!exactKeys(candidate, ["indicator", "period", "operator", "value"]))
          issue(path, "PROPERTIES", "RSI condition contains unsupported properties");
        if (!nonNegativeNumber(candidate.value)) issue(`${path}.value`, "VALUE", "value must be a non-negative finite number");
        if (typeof candidate.value === "number" && candidate.value > 100)
          issue(`${path}.value`, "VALUE", "RSI value cannot exceed 100");
        if (!["LT", "LTE", "GT", "GTE"].includes(candidate.operator as string))
          issue(`${path}.operator`, "UNSUPPORTED_OPERATOR", "RSI supports LT, LTE, GT, and GTE");
      } else if (candidate.indicator === "EMA_DISTANCE") {
        if (!positiveInteger(candidate.period)) issue(`${path}.period`, "VALUE", "period must be a positive safe integer");
        const emaKeys = candidate.maximumDistancePct === undefined
          ? ["indicator", "period", "position"] : ["indicator", "period", "position", "maximumDistancePct"];
        if (!exactKeys(candidate, emaKeys))
          issue(path, "PROPERTIES", "EMA_DISTANCE condition contains unsupported properties");
        if (!["ABOVE", "BELOW"].includes(candidate.position as string))
          issue(`${path}.position`, "VALUE", "position must be ABOVE or BELOW");
        if (candidate.maximumDistancePct !== undefined && !percentageWithAtMostOneDecimal(candidate.maximumDistancePct))
          issue(`${path}.maximumDistancePct`, "VALUE", "maximumDistancePct must be between 0 and 100 with at most one decimal place");
      } else if (candidate.indicator === "EMA_DEVIATION_PCT") {
        if (!exactKeys(candidate, ["indicator", "period", "operator", "value"]))
          issue(path, "PROPERTIES", "EMA_DEVIATION_PCT condition contains unsupported properties");
        if (!positiveInteger(candidate.period)) issue(`${path}.period`, "VALUE", "period must be a positive safe integer");
        if (!["LT", "LTE", "GT", "GTE"].includes(candidate.operator as string))
          issue(`${path}.operator`, "UNSUPPORTED_OPERATOR", "EMA_DEVIATION_PCT supports LT, LTE, GT, and GTE");
        if (typeof candidate.value !== "number" || !Number.isFinite(candidate.value))
          issue(`${path}.value`, "VALUE", "EMA_DEVIATION_PCT value must be a finite signed percentage");
      } else if (candidate.indicator === "EMA_CROSS_CONFIRMATION") {
        if (!exactKeys(candidate, ["indicator", "period", "direction", "confirmationCandles"]))
          issue(path, "PROPERTIES", "EMA_CROSS_CONFIRMATION condition contains unsupported properties");
        if (!positiveInteger(candidate.period)) issue(`${path}.period`, "VALUE", "period must be a positive safe integer");
        if (!["ABOVE", "BELOW"].includes(candidate.direction as string))
          issue(`${path}.direction`, "VALUE", "direction must be ABOVE or BELOW");
        if (!positiveInteger(candidate.confirmationCandles))
          issue(`${path}.confirmationCandles`, "VALUE", "confirmationCandles must be a positive safe integer");
      } else if (candidate.indicator === "MARKET_REGIME") {
        if (!exactKeys(candidate, ["indicator", "value"]))
          issue(path, "PROPERTIES", "MARKET_REGIME condition contains unsupported properties");
        if (!["BULLISH", "BEARISH", "SIDEWAYS"].includes(candidate.value as string))
          issue(`${path}.value`, "VALUE", "MARKET_REGIME value must be BULLISH, BEARISH, or SIDEWAYS");
      } else if (candidate.indicator === "EMA_SLOPE") {
        if (!exactKeys(candidate, ["indicator", "period", "lookbackCandles", "operator", "value"]))
          issue(path, "PROPERTIES", "EMA_SLOPE condition contains unsupported properties");
        if (!positiveInteger(candidate.period)) issue(`${path}.period`, "VALUE", "period must be a positive safe integer");
        if (!positiveInteger(candidate.lookbackCandles))
          issue(`${path}.lookbackCandles`, "VALUE", "lookbackCandles must be a positive safe integer");
        if (!["LT", "LTE", "GT", "GTE"].includes(candidate.operator as string))
          issue(`${path}.operator`, "UNSUPPORTED_OPERATOR", "EMA_SLOPE supports LT, LTE, GT, and GTE");
        if (typeof candidate.value !== "number" || !Number.isFinite(candidate.value))
          issue(`${path}.value`, "VALUE", "EMA_SLOPE value must be a finite signed percentage");
      } else if (candidate.indicator === "POSITION_RETURN_PCT") {
        if (!exactKeys(candidate, ["indicator", "operator", "value"]))
          issue(path, "PROPERTIES", "POSITION_RETURN_PCT condition contains unsupported properties");
        if (!positionConditionsAllowed)
          issue(path, "POSITION_CONTEXT", "POSITION_RETURN_PCT is supported only in exit conditions");
        if (!["LT", "LTE", "GT", "GTE"].includes(candidate.operator as string))
          issue(`${path}.operator`, "UNSUPPORTED_OPERATOR", "POSITION_RETURN_PCT supports LT, LTE, GT, and GTE");
        if (typeof candidate.value !== "number" || !Number.isFinite(candidate.value))
          issue(`${path}.value`, "VALUE", "POSITION_RETURN_PCT value must be a finite signed number");
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
  condition(value.entry, "$.entry", 1, false);
  condition(value.exit, "$.exit", 1, true);
  return issues.length === 0
    ? { ok: true, definition: value as StrategyDefinitionV1, issues: [] }
    : { ok: false, definition: null, issues };
}
