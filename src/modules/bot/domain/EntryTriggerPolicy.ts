import type { EntryPolicy } from "@/src/modules/strategy";

export type EntryTriggerState = { previousEntryMatched: boolean; lastEntryFillIndex: number | null };
export type EntryTriggerResult = {
  allowed: boolean;
  reason: "ENTRY_TRIGGER_ALLOWED" | "ENTRY_NOT_MATCHED" | "ENTRY_NOT_REARMED" | "ENTRY_COOLDOWN_ACTIVE";
  state: EntryTriggerState;
};

export const DEFAULT_ENTRY_POLICY: Required<EntryPolicy> = {
  trigger: "EVERY_MATCHING_CANDLE",
  cooldownCandles: 0,
};

export function applyEntryTriggerPolicy(policy: EntryPolicy | undefined, state: EntryTriggerState,
  entryMatched: boolean, candleIndex: number): EntryTriggerResult {
  const configured = { ...DEFAULT_ENTRY_POLICY, ...policy };
  const next = { ...state, previousEntryMatched: entryMatched };
  if (!entryMatched) return { allowed: false, reason: "ENTRY_NOT_MATCHED", state: next };
  if (configured.trigger === "ON_FALSE_TO_TRUE" && state.previousEntryMatched)
    return { allowed: false, reason: "ENTRY_NOT_REARMED", state: next };
  if (configured.cooldownCandles > 0 && state.lastEntryFillIndex !== null &&
      candleIndex - state.lastEntryFillIndex < configured.cooldownCandles)
    return { allowed: false, reason: "ENTRY_COOLDOWN_ACTIVE", state: next };
  return { allowed: true, reason: "ENTRY_TRIGGER_ALLOWED", state: next };
}
