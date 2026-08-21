import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  AddStrategyVersionUseCase,
  CreateStrategyUseCase,
  STRATEGY_DEFINITION_V1_JSON_SCHEMA,
  validateStrategyDefinition,
  type Strategy,
  type StrategyRepository,
  type StrategyVersion,
} from "@/src/modules/strategy";

const example = {
  schemaVersion: 1,
  name: "RSI EMA and red-candle entry",
  entry: { any: [
    { all: [
      { indicator: "RSI", period: 14, operator: "LT", value: 20 },
      { indicator: "EMA_DISTANCE", period: 100, position: "ABOVE", maximumDistancePct: 2 },
    ] },
    { candleSequence: { count: 3, direction: "RED", minimumBodyChangePct: 1 } },
  ] },
  exit: { all: [{ indicator: "RSI", period: 14, operator: "GTE", value: 80 }] },
};

class MemoryStrategyRepository implements StrategyRepository {
  strategies: Strategy[] = [];
  findAllByUserId(userId: string) { return Promise.resolve(this.strategies.filter((item) => item.userId === userId)); }
  findById(id: string) { return Promise.resolve(this.strategies.find((item) => item.id === id) ?? null); }
  findVersionById(id: string) { return Promise.resolve(this.strategies.flatMap((item) => item.versions).find((item) => item.id === id) ?? null); }
  async save(strategy: Strategy) { this.strategies.push(strategy); }
  async createNextVersion(strategyId: string, definition: StrategyVersion["definition"], schemaVersion: number, createdAt: Date) {
    const strategy = await this.findById(strategyId); if (!strategy) throw new Error("Strategy not found");
    const version = { id: `version-${strategy.versions.length + 1}`, strategyId,
      version: Math.max(0, ...strategy.versions.map((item) => item.version)) + 1,
      schemaVersion, definition, createdAt };
    strategy.versions.push(version); return version;
  }
}

describe("strategy definition v1", () => {
  test("represents and validates the documented nested strategy", () => {
    const result = validateStrategyDefinition(example);
    assert.equal(result.ok, true);
    assert.equal(STRATEGY_DEFINITION_V1_JSON_SCHEMA.properties.schemaVersion.const, 1);
    const emaSchema = STRATEGY_DEFINITION_V1_JSON_SCHEMA.$defs.emaDistance;
    assert.deepEqual(emaSchema.required, ["indicator", "period", "position"]);
    assert.deepEqual(emaSchema.properties.position.enum, ["ABOVE", "BELOW"]);
    assert.equal(emaSchema.properties.maximumDistancePct.maximum, 100);
    assert.equal(emaSchema.properties.maximumDistancePct.multipleOf, 0.1);
    assert.deepEqual(STRATEGY_DEFINITION_V1_JSON_SCHEMA.$defs.emaCrossConfirmation.required,
      ["indicator", "period", "direction", "confirmationCandles"]);
    assert.deepEqual(STRATEGY_DEFINITION_V1_JSON_SCHEMA.properties.entryPolicy.properties.trigger.enum,
      ["EVERY_MATCHING_CANDLE", "ON_FALSE_TO_TRUE"]);
    assert.deepEqual(STRATEGY_DEFINITION_V1_JSON_SCHEMA.$defs.positionReturnPct.properties.operator.enum,
      ["LT", "LTE", "GT", "GTE"]);
    if (result.ok) assert.deepEqual(result.definition, example);
  });

  test("rejects unknown properties, empty groups, bad values, indicators, and operator combinations", () => {
    const cases = [
      { ...example, extra: true },
      { ...example, entry: { all: [] } },
      { ...example, entry: { indicator: "RSI", period: 0, operator: "LT", value: 20 } },
      { ...example, entry: { indicator: "RSI", period: 14, operator: "LT", value: 101 } },
      { ...example, entry: { indicator: "MACD", period: 14, operator: "LT", value: 20 } },
      { ...example, entry: { indicator: "EMA_DISTANCE", period: 14, operator: "ABS_LTE", value: 0.02 } },
      { ...example, entry: { indicator: "EMA_DISTANCE", period: 14, position: "SIDEWAYS" } },
      { ...example, entry: { indicator: "EMA_DISTANCE", period: 14, position: "ABOVE", maximumDistancePct: -0.1 } },
      { ...example, entry: { indicator: "EMA_DISTANCE", period: 14, position: "ABOVE", maximumDistancePct: 100.1 } },
      { ...example, entry: { indicator: "EMA_DISTANCE", period: 14, position: "ABOVE", maximumDistancePct: 2.25 } },
      { ...example, entry: { indicator: "EMA_DEVIATION_PCT", period: 14, operator: "EQ", value: -2 } },
      { ...example, entry: { indicator: "EMA_DEVIATION_PCT", period: 14, operator: "LTE", value: Number.NaN } },
      { ...example, entry: { indicator: "EMA_CROSS_CONFIRMATION", period: 100, direction: "ABOVE", confirmationCandles: 0 } },
      { ...example, entry: { indicator: "EMA_CROSS_CONFIRMATION", period: 100, direction: "SIDEWAYS", confirmationCandles: 3 } },
      { ...example, entry: { candleSequence: { count: 3, direction: "BLUE", minimumBodyChangePct: 1 } } },
      { ...example, entryPolicy: { trigger: "SOMETIMES" } },
      { ...example, entryPolicy: { trigger: "ON_FALSE_TO_TRUE", cooldownCandles: -1 } },
      { ...example, entryPolicy: { trigger: "EVERY_MATCHING_CANDLE", cooldownCandles: 1.5 } },
      { ...example, entry: { indicator: "POSITION_RETURN_PCT", operator: "GTE", value: 2 } },
      { ...example, exit: { indicator: "POSITION_RETURN_PCT", operator: "EQ", value: 2 } },
      { ...example, exit: { indicator: "POSITION_RETURN_PCT", operator: "LTE", value: Number.NaN } },
      { ...example, entry: { indicator: "TRAILING_RETURN_PCT", activationPct: 5,
        minimumExitPct: 3, trailingDistancePct: 3 } },
      { ...example, exit: { indicator: "TRAILING_RETURN_PCT", activationPct: 5,
        minimumExitPct: 6, trailingDistancePct: 3 } },
      { ...example, exit: { indicator: "TRAILING_RETURN_PCT", activationPct: 5,
        minimumExitPct: 3, trailingDistancePct: 0 } },
      { ...example, exit: { indicator: "TRAILING_RETURN_PCT", activationPct: Number.NaN,
        minimumExitPct: 3, trailingDistancePct: 3 } },
    ];
    for (const candidate of cases) assert.equal(validateStrategyDefinition(candidate).ok, false);
    assert.equal(validateStrategyDefinition(example, 2).ok, false);
    assert.equal(validateStrategyDefinition({ ...example,
      entry: { indicator: "EMA_DISTANCE", period: 14, position: "BELOW" } }).ok, true);
    assert.equal(validateStrategyDefinition({ ...example,
      entry: { indicator: "EMA_DISTANCE", period: 14, position: "ABOVE", maximumDistancePct: 0 } }).ok, true);
    assert.equal(validateStrategyDefinition({ ...example,
      entry: { indicator: "EMA_DISTANCE", period: 14, position: "ABOVE", maximumDistancePct: 100 } }).ok, true);
    assert.equal(validateStrategyDefinition({ ...example,
      entry: { indicator: "EMA_DEVIATION_PCT", period: 100, operator: "LTE", value: -2 } }).ok, true);
    assert.equal(validateStrategyDefinition({ ...example,
      entry: { indicator: "EMA_CROSS_CONFIRMATION", period: 100, direction: "ABOVE", confirmationCandles: 3 } }).ok, true);
    assert.equal(validateStrategyDefinition({ ...example,
      entry: { indicator: "MARKET_REGIME", value: "BULLISH" } }).ok, true);
    assert.equal(validateStrategyDefinition({ ...example,
      entry: { indicator: "EMA_SLOPE", period: 100, lookbackCandles: 12, operator: "GTE", value: 0.3 } }).ok, true);
    assert.equal(validateStrategyDefinition({ ...example,
      entryPolicy: { trigger: "ON_FALSE_TO_TRUE", cooldownCandles: 12 } }).ok, true);
    assert.equal(validateStrategyDefinition({ ...example, exit: { any: [
      { indicator: "POSITION_RETURN_PCT", operator: "GTE", value: 2 },
      { indicator: "POSITION_RETURN_PCT", operator: "LTE", value: -4 },
    ] } }).ok, true);
    assert.equal(validateStrategyDefinition({ ...example, exit: { any: [
      { indicator: "POSITION_RETURN_PCT", operator: "LTE", value: -2 },
      { all: [{ indicator: "TRAILING_RETURN_PCT", activationPct: 5,
        minimumExitPct: 3, trailingDistancePct: 3 }] },
    ] } }).ok, true);
  });

  test("validates before creating immutable versions", async () => {
    const repository = new MemoryStrategyRepository();
    const create = new CreateStrategyUseCase(repository);
    assert.equal((await create.execute({ userId: "user", name: "Bad", definition: {} })).ok, false);
    const created = await create.execute({ userId: "user", name: "Valid", definition: example });
    assert.equal(created.ok, true);
    assert.equal(repository.strategies.length, 1);
    if (!created.ok) return;
    assert.equal((await create.execute({ userId: "user", name: "Valid", definition: example })).ok, false);
    const add = new AddStrategyVersionUseCase(repository);
    assert.equal((await add.execute("other-user", created.strategy.id, { ...example, name: "foreign" })).ok, false);
    assert.equal((await add.execute("user", created.strategy.id, { ...example, entry: { indicator: "RSI", period: 14, operator: "NOPE", value: 20 } })).ok, false);
    const added = await add.execute("user", created.strategy.id, { ...example, name: "v2" });
    assert.equal(added.ok, true);
    if (added.ok) assert.equal(added.version.version, 2);
  });
});
