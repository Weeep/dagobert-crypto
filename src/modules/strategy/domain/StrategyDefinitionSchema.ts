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
  },
  $defs: {
    condition: { oneOf: [
      { $ref: "#/$defs/all" }, { $ref: "#/$defs/any" }, { $ref: "#/$defs/rsi" },
      { $ref: "#/$defs/emaDistance" }, { $ref: "#/$defs/candleSequence" },
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
    emaDistance: { type: "object", additionalProperties: false, required: ["indicator", "period", "operator", "value"], properties: {
      indicator: { const: "EMA_DISTANCE" }, period: { type: "integer", minimum: 1 },
      operator: { const: "ABS_LTE" }, value: { type: "number", minimum: 0 },
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
