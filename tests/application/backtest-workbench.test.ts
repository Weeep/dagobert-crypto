import assert from "node:assert/strict";
import { test } from "node:test";
import { collectNearMisses, getStoredWorkbench, storeWorkbench,
  type StoredWorkbench } from "@/src/modules/bot/application/BacktestWorkbench";
import type { HistoricalBacktestResult } from "@/src/modules/bot";
import type { ConditionEvaluation, StrategyDefinitionV1 } from "@/src/modules/strategy";

const leaf = (type: ConditionEvaluation["type"], matched: boolean): ConditionEvaluation => ({ type, matched,
  reasonCode: matched ? `${type}_MATCHED` : `${type}_NOT_MATCHED`, explanation: "", observedValues: {}, children: [] });
const runnerWithEntry = (entry: ConditionEvaluation) => ({ decisions: [{ evaluation: { entry } }] }) as HistoricalBacktestResult;

test("workbench near misses keep structurally different composite conditions separate", () => {
  const definition = { schemaVersion: 1, name: "nested", entryPolicy: { trigger: "ON_FALSE_TO_TRUE", cooldownCandles: 0 },
    entry: { all: [
      { any: [{ indicator: "RSI", period: 14, operator: "LTE", value: 30 },
        { indicator: "RSI", period: 7, operator: "LTE", value: 20 }] },
      { any: [{ indicator: "RSI", period: 21, operator: "LTE", value: 40 },
        { indicator: "RSI", period: 5, operator: "LTE", value: 10 }] },
    ] }, exit: { all: [{ indicator: "RSI", period: 14, operator: "GTE", value: 80 }] } } as StrategyDefinitionV1;
  const firstAny = { type: "ANY", matched: false, reasonCode: "ANY_NOT_MATCHED", explanation: "",
    observedValues: {}, children: [leaf("RSI", false), leaf("RSI", false)] } satisfies ConditionEvaluation;
  const secondAny = { type: "ANY", matched: false, reasonCode: "ANY_NOT_MATCHED", explanation: "",
    observedValues: {}, children: [leaf("RSI", false), leaf("RSI", false)] } satisfies ConditionEvaluation;
  const misses = collectNearMisses(definition, runnerWithEntry({ type: "ALL", matched: false,
    reasonCode: "ALL_NOT_MATCHED", explanation: "", observedValues: {},
    children: [firstAny, { ...secondAny, matched: true }] }));
  assert.deepEqual(misses, [{ condition: "ANY(RSI(14) LTE 30, RSI(7) LTE 20)", count: 1 }]);
  const other = collectNearMisses(definition, runnerWithEntry({ type: "ALL", matched: false,
    reasonCode: "ALL_NOT_MATCHED", explanation: "", observedValues: {},
    children: [{ ...firstAny, matched: true }, secondAny] }));
  assert.deepEqual(other, [{ condition: "ANY(RSI(21) LTE 40, RSI(5) LTE 10)", count: 1 }]);
});

test("temporary workbenches are evicted when their retention period expires", async () => {
  const stored = { id: "expiring", userId: "user", definition: {} as StrategyDefinitionV1,
    from: new Date(), to: new Date(), expiresAt: Date.now() + 10, botIds: new Map(), results: new Map() } satisfies StoredWorkbench;
  storeWorkbench(stored);
  assert.equal(getStoredWorkbench(stored.id, stored.userId), stored);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(getStoredWorkbench(stored.id, stored.userId), null);
});
