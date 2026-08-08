import assert from "node:assert/strict";
import test, { describe } from "node:test";
import type { CandleChartResult, CandlesOptions } from "binance-api-node";
import { BinanceRestMarketDataSource } from "@/src/modules/market/infrastructure/binance/BinanceRestMarketDataSource";

const hour = 3_600_000;
const start = Date.parse("2026-08-01T00:00:00.000Z");

function row(openTime: number, close = "105"): CandleChartResult {
  return {
    openTime,
    closeTime: openTime + hour - 1,
    open: "100",
    high: "110",
    low: "90",
    close,
    volume: "10",
    quoteVolume: "1000",
    trades: 20,
    baseAssetVolume: "5",
    quoteAssetVolume: "500",
  };
}

describe("Binance REST market-data adapter", () => {
  test("maps closed candles and paginates deterministically in ascending order", async () => {
    const requests: CandlesOptions[] = [];
    const pages = [[row(start), row(start + hour)], [row(start + (2 * hour))]];
    const client = {
      time: async () => start + (10 * hour),
      candles: async (options: CandlesOptions) => {
        requests.push(options);
        return pages[requests.length - 1] ?? [];
      },
    };
    const source = new BinanceRestMarketDataSource(client as never, { now: () => start + (9 * hour) });
    const result = await source.fetchHistoricalCandles({
      pairSymbol: "BTCUSDC", interval: "1h", from: new Date(start),
      to: new Date(start + (3 * hour)), pageSize: 2,
    });
    assert.deepEqual(result.candles.map((candle) => candle.openTime.getTime()),
      [start, start + hour, start + (2 * hour)]);
    assert.equal(result.candles.every((candle) => candle.isClosed && candle.source === "BINANCE"), true);
    assert.deepEqual(requests.map((request) => request.startTime), [start, start + (2 * hour)]);
    assert.equal(requests[0].endTime, start + (3 * hour) - 1);
    assert.equal(result.clockOffsetMs, BigInt(hour));
  });

  test("excludes the current open REST candle using Binance server time", async () => {
    const client = {
      time: async () => start + hour + 10_000,
      candles: async () => [row(start), row(start + hour)],
    };
    const source = new BinanceRestMarketDataSource(client as never, { now: () => start + hour });
    const result = await source.fetchHistoricalCandles({ pairSymbol: "BTCUSDC", interval: "1h",
      from: new Date(start), to: new Date(start + (2 * hour)) });
    assert.deepEqual(result.candles.map((candle) => candle.openTime.getTime()), [start]);
  });

  test("retries rate limits with bounded jitter and rejects malformed ordering", async () => {
    let attempts = 0;
    const delays: number[] = [];
    const client = {
      time: async () => {
        attempts += 1;
        if (attempts === 1) throw Object.assign(new Error("limited"), { status: 429 });
        return start + (5 * hour);
      },
      candles: async () => [row(start + hour), row(start)],
    };
    const source = new BinanceRestMarketDataSource(client as never, {
      now: () => start,
      maxRetries: 1,
      retryBaseDelayMs: 100,
      random: () => 0.5,
      sleep: async (delay) => { delays.push(delay); },
    });
    await assert.rejects(() => source.fetchHistoricalCandles({ pairSymbol: "BTCUSDC", interval: "1h",
      from: new Date(start), to: new Date(start + (2 * hour)) }), /duplicated or out-of-order/);
    assert.equal(attempts, 2);
    assert.deepEqual(delays, [100]);
  });

  test("honors cancellation before making an exchange request", async () => {
    const controller = new AbortController();
    controller.abort();
    let called = false;
    const source = new BinanceRestMarketDataSource({
      time: async () => { called = true; return start; },
      candles: async () => [],
    } as never);
    await assert.rejects(() => source.fetchServerTime(controller.signal), { name: "AbortError" });
    assert.equal(called, false);
  });
});
