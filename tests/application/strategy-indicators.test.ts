import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  calculateCandleBodyChangePct,
  calculateEma,
  calculateRsi,
  classifyCandleDirection,
  matchesCandleSequence,
} from "@/src/modules/strategy";
import { TradingAnalysis, type DCandle } from "@/app/lib/TradingAnalysis";

const prices = (values: readonly number[]) => values.map((close) => ({ close: String(close), isClosed: true }));

describe("shared technical indicators", () => {
  test("matches Wilder's published RSI worksheet and keeps the legacy analysis on the shared calculation", () => {
    const closes = [
      44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08,
      45.89, 46.03, 45.61, 46.28, 46.28, 46, 46.03, 46.41, 46.22, 45.64,
    ];
    assert.ok(Math.abs(calculateRsi(prices(closes.slice(0, 15)), 14)! - 70.46413502109705) < 1e-12);
    assert.ok(Math.abs(calculateRsi(prices(closes), 14)! - 57.91502067008556) < 1e-12);

    const candles = closes.map((close, openTime) => ({ openTime, close: String(close) })) as unknown as DCandle[];
    const legacy = new TradingAnalysis(candles, closes.at(-1)!);
    assert.equal(legacy.getRsi(14), calculateRsi(prices(closes), 14));
    assert.equal(legacy.calculateRsi(14), calculateRsi(prices(closes), 14));
  });

  test("uses SMA seeds, Wilder smoothing, neutral flat RSI, and null warm-up values", () => {
    assert.equal(calculateRsi(prices([1, 2, 3]), 3), null);
    assert.equal(calculateRsi(prices([1, 1, 1, 1]), 3), 50);
    assert.equal(calculateRsi(prices([1, 2, 3, 4]), 3), 100);
    assert.equal(calculateRsi(prices([4, 3, 2, 1]), 3), 0);

    assert.equal(calculateEma(prices([10, 20]), 3), null);
    assert.equal(calculateEma(prices([10, 20, 30]), 3), 20);
    assert.equal(calculateEma(prices([10, 20, 30, 40]), 3), 30);
  });

  test("rejects invalid periods and explicitly open candles", () => {
    assert.throws(() => calculateRsi(prices([1, 2]), 0), /positive safe integer/);
    assert.throws(() => calculateEma([{ close: "1", isClosed: false }], 1), /closed candles/);
  });

  test("extends historical candles in chronological order without looking ahead", () => {
    const closes = [1, 2, 3, 2, 4];
    const candles = closes.map((close, openTime) => ({ openTime, close: String(close) })) as unknown as DCandle[];
    const extended = new TradingAnalysis(candles, 4).extend();
    assert.deepEqual(extended.map((candle) => candle.rsi6), [null, null, null, null, null]);
    assert.deepEqual(extended.map((candle) => candle.ema7), [null, null, null, null, null]);
  });
});

describe("candle facts", () => {
  test("classifies direction and calculates absolute body percentage", () => {
    assert.equal(classifyCandleDirection({ open: "100", close: "99" }), "RED");
    assert.equal(classifyCandleDirection({ open: "100", close: "101" }), "GREEN");
    assert.equal(classifyCandleDirection({ open: "100", close: "100.0" }), "DOJI");
    assert.equal(calculateCandleBodyChangePct({ open: "100", close: "99" }), 1);
    assert.throws(() => calculateCandleBodyChangePct({ open: "0", close: "0" }), /greater than zero/);
  });

  test("matches only the requested trailing consecutive sequence", () => {
    const candles = [
      { open: "100", close: "101" },
      { open: "100", close: "99" },
      { open: "200", close: "198" },
      { open: "50", close: "49.5" },
    ];
    assert.equal(matchesCandleSequence(candles, {
      count: 3, direction: "RED", minimumBodyChangePct: 1,
    }), true);
    assert.equal(matchesCandleSequence(candles, {
      count: 4, direction: "RED", minimumBodyChangePct: 1,
    }), false);
    assert.equal(matchesCandleSequence(candles.slice(0, 2), {
      count: 3, direction: "RED", minimumBodyChangePct: 1,
    }), false);
  });
});
