import assert from "node:assert/strict";
import test from "node:test";
import { applyEntryTriggerPolicy, type EntryTriggerState } from "@/src/modules/bot";

test("EVERY_MATCHING_CANDLE preserves level-triggered entries", () => {
  let state: EntryTriggerState = { previousEntryMatched: false, lastEntryFillIndex: null };
  for (let index = 0; index < 3; index += 1) {
    const result = applyEntryTriggerPolicy({ trigger: "EVERY_MATCHING_CANDLE" }, state, true, index);
    assert.equal(result.allowed, true); state = result.state;
  }
});

test("ON_FALSE_TO_TRUE requires a non-matching candle before rearming", () => {
  let state: EntryTriggerState = { previousEntryMatched: false, lastEntryFillIndex: null };
  const first = applyEntryTriggerPolicy({ trigger: "ON_FALSE_TO_TRUE" }, state, true, 0);
  assert.equal(first.allowed, true);
  const repeated = applyEntryTriggerPolicy({ trigger: "ON_FALSE_TO_TRUE" }, first.state, true, 1);
  assert.equal(repeated.allowed, false); assert.equal(repeated.reason, "ENTRY_NOT_REARMED");
  const falseCandle = applyEntryTriggerPolicy({ trigger: "ON_FALSE_TO_TRUE" }, repeated.state, false, 2);
  const rearmed = applyEntryTriggerPolicy({ trigger: "ON_FALSE_TO_TRUE" }, falseCandle.state, true, 3);
  assert.equal(rearmed.allowed, true);
});

test("cooldown suppresses the configured number of close evaluations after a fill", () => {
  const state: EntryTriggerState = { previousEntryMatched: true, lastEntryFillIndex: 5 };
  assert.equal(applyEntryTriggerPolicy({ trigger: "EVERY_MATCHING_CANDLE", cooldownCandles: 2 },
    state, true, 5).reason, "ENTRY_COOLDOWN_ACTIVE");
  assert.equal(applyEntryTriggerPolicy({ trigger: "EVERY_MATCHING_CANDLE", cooldownCandles: 2 },
    state, true, 6).allowed, false);
  assert.equal(applyEntryTriggerPolicy({ trigger: "EVERY_MATCHING_CANDLE", cooldownCandles: 2 },
    state, true, 7).allowed, true);
});
