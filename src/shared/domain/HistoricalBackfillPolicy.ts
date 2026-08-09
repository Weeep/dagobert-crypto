import type { MarketInterval } from "./MarketInterval";
import { MARKET_INTERVAL_MILLISECONDS } from "./MarketInterval";

/** Default amount imported by one invocation and selected by a range without an explicit start. */
export const DEFAULT_BACKFILL_CANDLE_COUNT = 15_000;

export function defaultBackfillStart(interval: MarketInterval, exclusiveEnd: Date): Date {
  const intervalMilliseconds = MARKET_INTERVAL_MILLISECONDS[interval];
  const alignedEnd = Math.floor(exclusiveEnd.getTime() / intervalMilliseconds) * intervalMilliseconds;
  return new Date(alignedEnd - (DEFAULT_BACKFILL_CANDLE_COUNT * intervalMilliseconds));
}
