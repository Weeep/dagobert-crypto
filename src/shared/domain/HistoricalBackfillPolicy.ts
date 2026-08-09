import type { MarketInterval } from "./MarketInterval";

/** Initial UTC boundary used when an operator does not provide a backfill start. */
export const DEFAULT_BACKFILL_START_BY_INTERVAL: Readonly<Record<MarketInterval, string>> = {
  "15m": "2025-01-01T00:00:00.000Z",
  "1h": "2025-01-01T00:00:00.000Z",
  "4h": "2023-01-01T00:00:00.000Z",
  "1d": "2018-01-01T00:00:00.000Z",
};

export function defaultBackfillStart(interval: MarketInterval): Date {
  return new Date(DEFAULT_BACKFILL_START_BY_INTERVAL[interval]);
}
