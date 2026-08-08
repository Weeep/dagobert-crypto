export type Candle = {
  id: string; pairSymbol: string; interval: string; openTime: Date; closeTime: Date;
  open: string; high: string; low: string; close: string; volume: string;
  quoteVolume: string; trades: number; isClosed: boolean; source: string; receivedAt: Date;
};
