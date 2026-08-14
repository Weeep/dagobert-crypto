import Big from "big.js";

export type CandleDirection = "RED" | "GREEN" | "DOJI";
export type CandlePrice = { open: string; close: string };

export function classifyCandleDirection(candle: CandlePrice): CandleDirection {
  const open = new Big(candle.open);
  const close = new Big(candle.close);
  if (close.lt(open)) return "RED";
  if (close.gt(open)) return "GREEN";
  return "DOJI";
}

/** Returns the absolute candle-body change as a percentage of its open price. */
export function calculateCandleBodyChangePct(candle: CandlePrice): number {
  const open = new Big(candle.open);
  if (open.eq(0)) throw new RangeError("candle open must be greater than zero");
  return Number(new Big(candle.close).minus(open).abs().div(open).times(100));
}

export type CandleSequenceRule = {
  count: number;
  direction: CandleDirection;
  minimumBodyChangePct: number;
};

/** Evaluates the last `count` candles; a longer matching prefix is irrelevant. */
export function matchesCandleSequence(
  candles: readonly CandlePrice[],
  rule: CandleSequenceRule,
): boolean {
  if (!Number.isSafeInteger(rule.count) || rule.count <= 0) {
    throw new RangeError("candle sequence count must be a positive safe integer");
  }
  if (!Number.isFinite(rule.minimumBodyChangePct) || rule.minimumBodyChangePct < 0) {
    throw new RangeError("minimum body change must be a non-negative finite percentage");
  }
  if (candles.length < rule.count) return false;
  return candles.slice(-rule.count).every((candle) =>
    classifyCandleDirection(candle) === rule.direction &&
    calculateCandleBodyChangePct(candle) >= rule.minimumBodyChangePct
  );
}
