/** JSON Schema contract for StrategyDefinitionV1. Runtime validation also enforces tree size/depth limits. */
export const STRATEGY_DEFINITION_V1_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://dagobert.local/schemas/strategy-definition-v1.json",
  title: "Dagobert Strategy Definition v1",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "name", "entry", "exit"],
  properties: {
    schemaVersion: { const: 1 },
    name: { type: "string", minLength: 1, maxLength: 120 },
    entry: { $ref: "#/$defs/condition" },
    exit: { $ref: "#/$defs/condition" },
    entryPolicy: { type: "object", additionalProperties: false, required: ["trigger"], properties: {
      trigger: { enum: ["EVERY_MATCHING_CANDLE", "ON_FALSE_TO_TRUE"] },
      cooldownCandles: { type: "integer", minimum: 0 },
    } },
  },
  $defs: {
    condition: { oneOf: [
      { $ref: "#/$defs/all" }, { $ref: "#/$defs/any" }, { $ref: "#/$defs/rsi" },
      { $ref: "#/$defs/emaDistance" }, { $ref: "#/$defs/candleSequence" },
      { $ref: "#/$defs/emaDeviationPct" },
      { $ref: "#/$defs/emaCrossConfirmation" },
      { $ref: "#/$defs/marketRegime" },
      { $ref: "#/$defs/emaSlope" },
      { $ref: "#/$defs/positionReturnPct" },
      { $ref: "#/$defs/trailingReturnPct" },
    ] },
    all: { type: "object", additionalProperties: false, required: ["all"], properties: {
      all: { type: "array", minItems: 1, items: { $ref: "#/$defs/condition" } },
    } },
    any: { type: "object", additionalProperties: false, required: ["any"], properties: {
      any: { type: "array", minItems: 1, items: { $ref: "#/$defs/condition" } },
    } },
    rsi: { type: "object", additionalProperties: false, required: ["indicator", "period", "operator", "value"], properties: {
      indicator: { const: "RSI" }, period: { type: "integer", minimum: 1 },
      operator: { enum: ["LT", "LTE", "GT", "GTE"] }, value: { type: "number", minimum: 0, maximum: 100 },
    } },
    emaDistance: { type: "object", additionalProperties: false, required: ["indicator", "period", "position"], properties: {
      indicator: { const: "EMA_DISTANCE" }, period: { type: "integer", minimum: 1 },
      position: { enum: ["ABOVE", "BELOW"] },
      maximumDistancePct: { type: "number", minimum: 0, maximum: 100, multipleOf: 0.1 },
    } },
    emaDeviationPct: { type: "object", additionalProperties: false,
      required: ["indicator", "period", "operator", "value"], properties: {
        indicator: { const: "EMA_DEVIATION_PCT" }, period: { type: "integer", minimum: 1 },
        operator: { enum: ["LT", "LTE", "GT", "GTE"] }, value: { type: "number" },
      } },
    emaCrossConfirmation: { type: "object", additionalProperties: false,
      required: ["indicator", "period", "direction", "confirmationCandles"], properties: {
        indicator: { const: "EMA_CROSS_CONFIRMATION" }, period: { type: "integer", minimum: 1 },
        direction: { enum: ["ABOVE", "BELOW"] }, confirmationCandles: { type: "integer", minimum: 1 },
      } },
    marketRegime: { type: "object", additionalProperties: false,
      required: ["indicator", "value"], properties: {
        indicator: { const: "MARKET_REGIME" }, value: { enum: ["BULLISH", "BEARISH", "SIDEWAYS"] },
      } },
    emaSlope: { type: "object", additionalProperties: false,
      required: ["indicator", "period", "lookbackCandles", "operator", "value"], properties: {
        indicator: { const: "EMA_SLOPE" }, period: { type: "integer", minimum: 1 },
        lookbackCandles: { type: "integer", minimum: 1 },
        operator: { enum: ["LT", "LTE", "GT", "GTE"] }, value: { type: "number" },
      } },
    positionReturnPct: { type: "object", additionalProperties: false,
      required: ["indicator", "operator", "value"], properties: {
        indicator: { const: "POSITION_RETURN_PCT" },
        operator: { enum: ["LT", "LTE", "GT", "GTE"] },
        value: { type: "number" },
      } },
    trailingReturnPct: { type: "object", additionalProperties: false,
      required: ["indicator", "activationPct", "minimumExitPct", "trailingDistancePct"], properties: {
        indicator: { const: "TRAILING_RETURN_PCT" }, activationPct: { type: "number" },
        minimumExitPct: { type: "number" }, trailingDistancePct: { type: "number", exclusiveMinimum: 0 },
      } },
    candleSequence: { type: "object", additionalProperties: false, required: ["candleSequence"], properties: {
      candleSequence: { type: "object", additionalProperties: false,
        required: ["count", "direction", "minimumBodyChangePct"], properties: {
          count: { type: "integer", minimum: 1 }, direction: { enum: ["RED", "GREEN", "DOJI"] },
          minimumBodyChangePct: { type: "number", minimum: 0 },
        } },
    } },
  },
} as const;
