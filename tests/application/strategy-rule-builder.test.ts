import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { appendCondition, CONDITION_KIND_OPTIONS, conditionAt, conditionKind, GROUP_CHILD_KINDS,
  newCondition, removeCondition, replaceCondition } from "@/app/components/pageBot/strategyRuleTree";
import { validateStrategyDefinition } from "@/src/modules/strategy";

describe("strategy rule-builder tree operations", () => {
  test("exposes EMA cross confirmation in both GUI rule selectors", () => {
    assert.deepEqual(CONDITION_KIND_OPTIONS.find(({ value }) => value === "EMA_CROSS_CONFIRMATION"),
      { value: "EMA_CROSS_CONFIRMATION", label: "EMA cross confirmation" });
    assert.equal(GROUP_CHILD_KINDS.includes("EMA_CROSS_CONFIRMATION"), true);
  });

  test("creates every supported rule kind", () => {
    assert.equal(conditionKind(newCondition("ALL")), "ALL");
    assert.equal(conditionKind(newCondition("ANY")), "ANY");
    assert.equal(conditionKind(newCondition("RSI")), "RSI");
    assert.equal(conditionKind(newCondition("EMA_DISTANCE")), "EMA_DISTANCE");
    assert.equal(conditionKind(newCondition("EMA_CROSS_CONFIRMATION")), "EMA_CROSS_CONFIRMATION");
    assert.equal(conditionKind(newCondition("CANDLE_SEQUENCE")), "CANDLE_SEQUENCE");
    assert.equal(conditionKind(newCondition("POSITION_RETURN_PCT")), "POSITION_RETURN_PCT");
    assert.deepEqual(newCondition("POSITION_RETURN_PCT"), {
      indicator: "POSITION_RETURN_PCT", operator: "GTE", value: 2,
    });
    assert.deepEqual(newCondition("EMA_DISTANCE"), {
      indicator: "EMA_DISTANCE", period: 100, position: "ABOVE", maximumDistancePct: 2,
    });
    assert.deepEqual(newCondition("EMA_CROSS_CONFIRMATION"), {
      indicator: "EMA_CROSS_CONFIRMATION", period: 100, direction: "ABOVE", confirmationCandles: 3,
    });
  });

  test("adds, replaces, locates, and removes nested rules immutably", () => {
    const original = newCondition("ALL");
    const withAny = appendCondition(original, [], newCondition("ANY"));
    const withSequence = appendCondition(withAny, [1], newCondition("CANDLE_SEQUENCE"));
    const replaced = replaceCondition(withSequence, [0], newCondition("EMA_DISTANCE"));
    assert.equal(conditionKind(conditionAt(replaced, [0])), "EMA_DISTANCE");
    assert.equal(conditionKind(conditionAt(replaced, [1, 1])), "CANDLE_SEQUENCE");
    const removed = removeCondition(replaced, [1, 1]);
    assert.throws(() => conditionAt(removed, [1, 1]), /invalid strategy condition path/);
    assert.equal(conditionKind(conditionAt(original, [0])), "RSI");
  });

  test("retains non-empty groups and emits a schema-valid definition", () => {
    const root = newCondition("ALL");
    assert.throws(() => removeCondition(root, [0]), /retain at least one child/);
    assert.throws(() => removeCondition(root, []), /root condition/);
    assert.equal(validateStrategyDefinition({ schemaVersion: 1, name: "Builder",
      entry: appendCondition(root, [], newCondition("EMA_DISTANCE")),
      exit: newCondition("ANY") }).ok, true);
  });
});
