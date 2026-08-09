import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  Candle,
  CandleIngestionCheckpoint,
  CandleIngestionCursor,
  CandleIngestionCursorRepository,
  CandleIngestionKey,
  CandleRepository,
} from "@/src/modules/market";
import { isMarketInterval } from "@/src/modules/market";
import { MARKET_INTERVAL_MILLISECONDS } from "@/src/modules/market";

type TransactionClient = Prisma.TransactionClient;
type CandleRow = Awaited<ReturnType<PrismaClient["candle"]["findFirstOrThrow"]>>;
type CursorRow = Awaited<ReturnType<PrismaClient["candleIngestionCursor"]["findFirstOrThrow"]>>;

const cursorWhere = (key: CandleIngestionKey) => ({
  source_pairSymbol_interval: {
    source: key.source,
    pairSymbol: key.pairSymbol,
    interval: key.interval,
  },
});

const mapCandle = (row: CandleRow): Candle => {
  if (!isMarketInterval(row.interval)) throw new Error(`Unsupported stored candle interval: ${row.interval}`);
  return {
    id: row.id,
    pairSymbol: row.pairSymbol,
    interval: row.interval,
    openTime: row.openTime,
    closeTime: row.closeTime,
    open: row.open.toString(),
    high: row.high.toString(),
    low: row.low.toString(),
    close: row.close.toString(),
    volume: row.volume.toString(),
    quoteVolume: row.quoteVolume.toString(),
    trades: row.trades,
    isClosed: row.isClosed,
    source: row.source,
    receivedAt: row.receivedAt,
  };
};

const mapCursor = (row: CursorRow): CandleIngestionCursor => {
  if (!isMarketInterval(row.interval)) throw new Error(`Unsupported stored cursor interval: ${row.interval}`);
  return {
    id: row.id,
    source: row.source,
    pairSymbol: row.pairSymbol,
    interval: row.interval,
    lastClosedOpenTime: row.lastClosedOpenTime,
    lastSuccessfulPollAt: row.lastSuccessfulPollAt,
    clockOffsetMs: row.clockOffsetMs,
    status: row.status,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

export class PrismaCandleRepository implements CandleRepository, CandleIngestionCursorRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string) {
    const row = await this.prisma.candle.findUnique({ where: { id } });
    return row ? mapCandle(row) : null;
  }

  async findRange(pairSymbol: string, interval: string, from: Date, to: Date) {
    return (await this.prisma.candle.findMany({
      where: { pairSymbol, interval, isClosed: true, openTime: { gte: from, lte: to } },
      orderBy: { openTime: "asc" },
    })).map(mapCandle);
  }

  async saveMany(candles: Candle[], checkpoint?: CandleIngestionCheckpoint) {
    if (candles.length === 0 && !checkpoint) return;
    await this.prisma.$transaction(async (transaction) => {
      for (const candle of candles) {
        await transaction.candle.upsert({
          where: { pairSymbol_interval_openTime: {
            pairSymbol: candle.pairSymbol,
            interval: candle.interval,
            openTime: candle.openTime,
          } },
          create: { ...candle },
          update: {
            closeTime: candle.closeTime,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume,
            quoteVolume: candle.quoteVolume,
            trades: candle.trades,
            isClosed: candle.isClosed,
            source: candle.source,
            receivedAt: candle.receivedAt,
          },
        });
      }
      if (checkpoint) {
        await this.verifyCheckpointContinuity(transaction, candles, checkpoint);
        await this.advanceCursor(transaction, checkpoint);
      }
    });
  }

  async find(key: CandleIngestionKey) {
    const row = await this.prisma.candleIngestionCursor.findUnique({ where: cursorWhere(key) });
    return row ? mapCursor(row) : null;
  }

  async recordError(key: CandleIngestionKey, message: string) {
    await this.prisma.candleIngestionCursor.upsert({
      where: cursorWhere(key),
      create: { ...key, status: "ERROR", lastError: message },
      update: { status: "ERROR", lastError: message },
    });
  }

  async advanceAfterVerifiedRange(checkpoint: CandleIngestionCheckpoint, contiguousFrom: Date) {
    await this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.candleIngestionCursor.findUnique({ where: cursorWhere(checkpoint) });
      if (existing?.lastClosedOpenTime &&
        existing.lastClosedOpenTime.getTime() >= checkpoint.lastClosedOpenTime.getTime()) return;

      const intervalMilliseconds = MARKET_INTERVAL_MILLISECONDS[checkpoint.interval];
      const expectedStart = existing?.lastClosedOpenTime
        ? existing.lastClosedOpenTime.getTime() + intervalMilliseconds
        : contiguousFrom.getTime();
      await this.verifyStoredRangeContinuity(transaction, checkpoint, expectedStart);
      await this.advanceCursor(transaction, checkpoint);
    });
  }

  private async verifyCheckpointContinuity(transaction: TransactionClient, candles: Candle[],
    checkpoint: CandleIngestionCheckpoint) {
    const existing = await transaction.candleIngestionCursor.findUnique({ where: cursorWhere(checkpoint) });
    if (existing?.lastClosedOpenTime &&
      existing.lastClosedOpenTime.getTime() >= checkpoint.lastClosedOpenTime.getTime()) return;

    const intervalMilliseconds = MARKET_INTERVAL_MILLISECONDS[checkpoint.interval];
    const batchStart = Math.min(...candles
      .filter((candle) => candle.pairSymbol === checkpoint.pairSymbol &&
        candle.interval === checkpoint.interval && candle.source === checkpoint.source)
      .map((candle) => candle.openTime.getTime()));
    const expectedStart = existing?.lastClosedOpenTime
      ? existing.lastClosedOpenTime.getTime() + intervalMilliseconds
      : batchStart;
    const checkpointTime = checkpoint.lastClosedOpenTime.getTime();
    const persisted = await transaction.candle.findMany({
      where: {
        pairSymbol: checkpoint.pairSymbol,
        interval: checkpoint.interval,
        isClosed: true,
        openTime: { gte: new Date(expectedStart), lte: checkpoint.lastClosedOpenTime },
      },
      select: { openTime: true },
      orderBy: { openTime: "asc" },
    });
    const expectedCount = Math.trunc((checkpointTime - expectedStart) / intervalMilliseconds) + 1;
    if (!Number.isFinite(expectedStart) || persisted.length !== expectedCount ||
      persisted.some((candle, index) =>
        candle.openTime.getTime() !== expectedStart + (index * intervalMilliseconds)))
      throw new Error("Cannot advance candle cursor across a missing or duplicated interval");
  }

  private async verifyStoredRangeContinuity(transaction: TransactionClient,
    checkpoint: CandleIngestionCheckpoint, expectedStart: number) {
    const intervalMilliseconds = MARKET_INTERVAL_MILLISECONDS[checkpoint.interval];
    const checkpointTime = checkpoint.lastClosedOpenTime.getTime();
    if (!Number.isFinite(expectedStart) || expectedStart > checkpointTime)
      throw new Error("Cannot advance candle cursor from an invalid contiguous range");
    const persisted = await transaction.candle.findMany({
      where: {
        pairSymbol: checkpoint.pairSymbol,
        interval: checkpoint.interval,
        source: checkpoint.source,
        isClosed: true,
        openTime: { gte: new Date(expectedStart), lte: checkpoint.lastClosedOpenTime },
      },
      select: { openTime: true },
      orderBy: { openTime: "asc" },
    });
    const expectedCount = Math.trunc((checkpointTime - expectedStart) / intervalMilliseconds) + 1;
    if (persisted.length !== expectedCount || persisted.some((candle, index) =>
      candle.openTime.getTime() !== expectedStart + (index * intervalMilliseconds)))
      throw new Error("Cannot advance candle cursor across a missing or duplicated interval");
  }

  private async advanceCursor(transaction: TransactionClient, checkpoint: CandleIngestionCheckpoint) {
    await transaction.candleIngestionCursor.upsert({
      where: cursorWhere(checkpoint),
      create: { ...checkpoint },
      update: {},
    });
    await transaction.candleIngestionCursor.updateMany({
      where: {
        source: checkpoint.source,
        pairSymbol: checkpoint.pairSymbol,
        interval: checkpoint.interval,
        OR: [
          { lastClosedOpenTime: null },
          { lastClosedOpenTime: { lte: checkpoint.lastClosedOpenTime } },
        ],
      },
      data: {
        lastClosedOpenTime: checkpoint.lastClosedOpenTime,
        lastSuccessfulPollAt: checkpoint.lastSuccessfulPollAt,
        clockOffsetMs: checkpoint.clockOffsetMs,
        status: "HEALTHY",
        lastError: null,
      },
    });
  }
}
