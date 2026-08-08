import type { Candle } from "../domain/Candle";
export type PersistedCandleDto = Omit<Candle, "openTime" | "closeTime" | "receivedAt"> & {
  openTime: string; closeTime: string; receivedAt: string;
};
export const toPersistedCandleDto = (candle: Candle): PersistedCandleDto => ({
  ...candle, openTime: candle.openTime.toISOString(), closeTime: candle.closeTime.toISOString(),
  receivedAt: candle.receivedAt.toISOString(),
});
