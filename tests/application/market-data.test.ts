import assert from "node:assert/strict";
import test, { describe } from "node:test";
import type { Candle, CandleIngestionCheckpoint, CandleRepository } from "@/src/modules/market";
import { SaveCandlesUseCase } from "@/src/modules/market";

const openTime = new Date("2026-08-01T00:00:00.000Z");

function candle(overrides: Partial<Candle> = {}): Candle {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    pairSymbol: "BTCUSDC",
    interval: "1h",
    openTime,
    closeTime: new Date(openTime.getTime() + 3_600_000 - 1),
    open: "100",
    high: "110",
    low: "90",
    close: "105",
    volume: "12.5",
    quoteVolume: "1300",
    trades: 42,
    isClosed: true,
    source: "BINANCE",
    receivedAt: new Date("2026-08-01T01:00:01.000Z"),
    ...overrides,
  };
}

class RecordingCandleRepository implements CandleRepository {
  calls: Array<{ candles: Candle[]; checkpoint?: CandleIngestionCheckpoint }> = [];
  findById() { return Promise.resolve(null); }
  findRange() { return Promise.resolve([]); }
  saveMany(candles: Candle[], checkpoint?: CandleIngestionCheckpoint) {
    this.calls.push({ candles, checkpoint });
    return Promise.resolve();
  }
}

describe("closed candle persistence validation", () => {
  test("saves an exact-decimal candle and its matching checkpoint together", async () => {
    const repository = new RecordingCandleRepository();
    const checkpoint: CandleIngestionCheckpoint = {
      source: "BINANCE",
      pairSymbol: "BTCUSDC",
      interval: "1h",
      lastClosedOpenTime: openTime,
      lastSuccessfulPollAt: new Date("2026-08-01T01:00:02.000Z"),
      clockOffsetMs: BigInt(125),
    };
    const result = await new SaveCandlesUseCase(repository).execute([candle()], checkpoint);
    assert.deepEqual(result, { ok: true, error: "", saved: 1 });
    assert.equal(repository.calls.length, 1);
    assert.equal(repository.calls[0].checkpoint, checkpoint);
  });

  test("uses exact decimal comparisons rather than lossy JavaScript numbers", async () => {
    const repository = new RecordingCandleRepository();
    const result = await new SaveCandlesUseCase(repository).execute([candle({
      open: "1000000000000000000.000000000000000001",
      close: "1000000000000000000.000000000000000001",
      low: "1000000000000000000.000000000000000002",
      high: "1000000000000000000.000000000000000003",
    })]);
    assert.equal(result.ok, false);
    assert.match(result.error, /OHLC/);
    assert.equal(repository.calls.length, 0);
  });

  test("rejects open candles, invalid interval timestamps, and detached checkpoints", async () => {
    const repository = new RecordingCandleRepository();
    const useCase = new SaveCandlesUseCase(repository);
    assert.equal((await useCase.execute([candle({ isClosed: false })])).ok, false);
    assert.equal((await useCase.execute([candle({ closeTime: new Date(openTime.getTime() + 3_600_000) })])).ok, false);
    assert.equal((await useCase.execute([candle()], {
      source: "BINANCE", pairSymbol: "BTCUSDC", interval: "1h",
      lastClosedOpenTime: new Date(openTime.getTime() + 3_600_000),
      lastSuccessfulPollAt: new Date(), clockOffsetMs: BigInt(0),
    })).ok, false);
    assert.equal(repository.calls.length, 0);
  });
});
