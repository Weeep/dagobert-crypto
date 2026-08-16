import type { StrategyCondition } from "@/src/modules/strategy/domain/StrategyDefinition";

export type ConditionKind = "ALL" | "ANY" | "RSI" | "EMA_DISTANCE" | "EMA_CROSS_CONFIRMATION" | "CANDLE_SEQUENCE" | "POSITION_RETURN_PCT";

export const CONDITION_KIND_OPTIONS: ReadonlyArray<{ value: ConditionKind; label: string }> = [
  { value: "ALL", label: "All conditions" },
  { value: "ANY", label: "Any condition" },
  { value: "RSI", label: "RSI" },
  { value: "EMA_DISTANCE", label: "EMA distance" },
  { value: "EMA_CROSS_CONFIRMATION", label: "EMA cross confirmation" },
  { value: "CANDLE_SEQUENCE", label: "Candle sequence" },
  { value: "POSITION_RETURN_PCT", label: "Position net return %" },
];

export const GROUP_CHILD_KINDS: readonly ConditionKind[] = [
  "RSI", "EMA_DISTANCE", "EMA_CROSS_CONFIRMATION", "CANDLE_SEQUENCE",
  "POSITION_RETURN_PCT", "ALL", "ANY",
];

export const conditionKind = (condition: StrategyCondition): ConditionKind => {
  if ("all" in condition) return "ALL";
  if ("any" in condition) return "ANY";
  if ("candleSequence" in condition) return "CANDLE_SEQUENCE";
  return condition.indicator;
};

export const newCondition = (kind: ConditionKind): StrategyCondition => {
  if (kind === "ALL") return { all: [newCondition("RSI")] };
  if (kind === "ANY") return { any: [newCondition("RSI")] };
  if (kind === "RSI") return { indicator: "RSI", period: 14, operator: "LT", value: 20 };
  if (kind === "EMA_DISTANCE")
    return { indicator: "EMA_DISTANCE", period: 100, position: "ABOVE", maximumDistancePct: 2 };
  if (kind === "EMA_CROSS_CONFIRMATION")
    return { indicator: "EMA_CROSS_CONFIRMATION", period: 100, direction: "ABOVE", confirmationCandles: 3 };
  if (kind === "POSITION_RETURN_PCT")
    return { indicator: "POSITION_RETURN_PCT", operator: "GTE", value: 2 };
  return { candleSequence: { count: 3, direction: "RED", minimumBodyChangePct: 1 } };
};

const children = (condition: StrategyCondition): StrategyCondition[] | null => {
  if ("all" in condition) return condition.all;
  if ("any" in condition) return condition.any;
  return null;
};

export function replaceCondition(
  root: StrategyCondition,
  path: readonly number[],
  replacement: StrategyCondition,
): StrategyCondition {
  if (path.length === 0) return replacement;
  const currentChildren = children(root);
  if (!currentChildren || path[0] < 0 || path[0] >= currentChildren.length)
    throw new RangeError("invalid strategy condition path");
  const next = currentChildren.map((child, index) => index === path[0]
    ? replaceCondition(child, path.slice(1), replacement) : child);
  return "all" in root ? { all: next } : { any: next };
}

export function appendCondition(root: StrategyCondition, path: readonly number[], value: StrategyCondition) {
  const target = conditionAt(root, path);
  const currentChildren = children(target);
  if (!currentChildren) throw new TypeError("conditions can only be appended to a group");
  return replaceCondition(root, path, "all" in target
    ? { all: [...currentChildren, value] }
    : { any: [...currentChildren, value] });
}

export function removeCondition(root: StrategyCondition, path: readonly number[]) {
  if (path.length === 0) throw new RangeError("the root condition cannot be removed");
  const parentPath = path.slice(0, -1);
  const parent = conditionAt(root, parentPath);
  const currentChildren = children(parent);
  if (!currentChildren || currentChildren.length <= 1)
    throw new RangeError("a condition group must retain at least one child");
  const index = path.at(-1)!;
  if (index < 0 || index >= currentChildren.length) throw new RangeError("invalid strategy condition path");
  return replaceCondition(root, parentPath, "all" in parent
    ? { all: currentChildren.filter((_, childIndex) => childIndex !== index) }
    : { any: currentChildren.filter((_, childIndex) => childIndex !== index) });
}

export function conditionAt(root: StrategyCondition, path: readonly number[]): StrategyCondition {
  return path.reduce((current, index) => {
    const currentChildren = children(current);
    if (!currentChildren?.[index]) throw new RangeError("invalid strategy condition path");
    return currentChildren[index];
  }, root);
}
