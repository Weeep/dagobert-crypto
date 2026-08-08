import type { PrismaClient } from "@prisma/client";
import type { Candle, CandleRepository } from "@/src/modules/market";
type CandleRow = Awaited<ReturnType<PrismaClient["candle"]["findFirstOrThrow"]>>;
const mapCandle = (row: CandleRow): Candle => ({
  id: row.id, pairSymbol: row.pairSymbol, interval: row.interval, openTime: row.openTime,
  closeTime: row.closeTime, open: row.open.toString(), high: row.high.toString(),
  low: row.low.toString(), close: row.close.toString(), volume: row.volume.toString(),
  quoteVolume: row.quoteVolume.toString(), trades: row.trades, isClosed: row.isClosed,
  source: row.source, receivedAt: row.receivedAt,
});
export class PrismaCandleRepository implements CandleRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async findById(id: string) { const row = await this.prisma.candle.findUnique({ where: { id } }); return row ? mapCandle(row) : null; }
  async findRange(pairSymbol: string, interval: string, from: Date, to: Date) {
    return (await this.prisma.candle.findMany({ where: { pairSymbol, interval,
      openTime: { gte: from, lte: to } }, orderBy: { openTime: "asc" } })).map(mapCandle);
  }
  async saveMany(candles: Candle[]) {
    if (candles.length === 0) return;
    await this.prisma.$transaction(candles.map((candle) => this.prisma.candle.upsert({
      where: { pairSymbol_interval_openTime: { pairSymbol: candle.pairSymbol,
        interval: candle.interval, openTime: candle.openTime } }, create: { ...candle },
      update: { closeTime: candle.closeTime, open: candle.open, high: candle.high,
        low: candle.low, close: candle.close, volume: candle.volume, quoteVolume: candle.quoteVolume,
        trades: candle.trades, isClosed: candle.isClosed, source: candle.source, receivedAt: candle.receivedAt },
    })));
  }
}
