import assert from "node:assert/strict";
import test from "node:test";
import type { Candle, CandleRepository } from "@/src/modules/market";
import { RunBacktestUseCase, StartBotUseCase, calculateBacktestMetrics,
  runHistoricalBacktest, type BacktestRunPersistenceRepository, type BotRepository,
  type BotRun, type BotRunRepository, type TradingBot } from "@/src/modules/bot";
import type { ClosedCandleHistoryRepository, Strategy, StrategyRepository,
  StrategyVersion } from "@/src/modules/strategy";
import { BotApiClient } from "@/app/components/pageBot/BotApiClient";

const candle = (index: number, open: string, close: string): Candle => { const openTime = new Date(Date.UTC(2026, 0, 1, index));
  return { id: `c-${index}`, pairSymbol: "BTCUSDC", interval: "1h", openTime,
    closeTime: new Date(openTime.getTime() + 3_599_999), open, high: "120", low: "90", close,
    volume: "1", quoteVolume: "100", trades: 1, isClosed: true, source: "TEST", receivedAt: new Date() }; };
const candles = [candle(0, "100", "101"), candle(1, "102", "103"),
  candle(2, "104", "100"), candle(3, "110", "112")];
const definition = { schemaVersion: 1 as const, name: "Run",
  entry: { candleSequence: { count: 1, direction: "GREEN" as const, minimumBodyChangePct: 0 } },
  exit: { candleSequence: { count: 1, direction: "RED" as const, minimumBodyChangePct: 0 } } };
const version: StrategyVersion = { id: "version", strategyId: "strategy", version: 1,
  schemaVersion: 1, definition, createdAt: new Date() };
const strategy: Strategy = { id: "strategy", userId: "owner", name: "Run", description: "",
  versions: [version], createdAt: new Date(), updatedAt: new Date() };
const now = new Date();
const bot: TradingBot = { id: "bot", userId: "owner", name: "Bot", pairSymbol: "BTCUSDC",
  assignedBudget: "55", amountPerPosition: "10", timeframe: "1h", mode: "BACKTEST", status: "DRAFT",
  strategyVersionId: version.id, feeRate: "0.001", slippageRate: "0.005", createdAt: now, updatedAt: now };

class Bots implements BotRepository {
  value = bot;
  async findAllByUserId() { return [this.value]; } async findById(id: string) { return id === bot.id ? this.value : null; }
  async findByUserIdAndName() { return null; } async save(value: TradingBot) { this.value = value; }
  async deleteIfNotRunning() { return true; }
}
class Runs implements BotRunRepository {
  values: BotRun[] = [];
  async findById(id: string) { return this.values.find((run) => run.id === id) ?? null; }
  async findAllByBotId() { return this.values; } async save(run: BotRun) { this.values.push(run); }
}
class Strategies implements StrategyRepository {
  async findAllByUserId() { return [strategy]; } async findById() { return strategy; }
  async findVersionById(id: string) { return id === version.id ? version : null; }
  async save() {} async createNextVersion() { return version; }
}
class Candles implements CandleRepository, ClosedCandleHistoryRepository {
  async findById() { return null; }
  async findRange(_pair: string, _interval: string, from: Date, to: Date) {
    return candles.filter((item) => item.openTime >= from && item.openTime <= to);
  }
  async findClosedHistoryEndingAt(_pair: string, _interval: string, through: Date, limit: number) {
    return candles.filter((item) => item.openTime <= through).slice(-limit);
  }
  async saveMany() {}
}
class Persistence implements BacktestRunPersistenceRepository {
  calls: Array<{ runId: string }> = [];
  async persistCompleted(runId: string) { this.calls.push({ runId }); return { reused: false }; }
  async markFailed() {}
}

test("backtest metrics cover profit, drawdown, fees, holding time, and buy-and-hold", () => {
  const execution = { assignedBudget: "55", amountPerPosition: "10", feeRate: "0.001", slippageRate: "0.005" };
  const result = runHistoricalBacktest({ definition, candles, backtestFrom: candles[0].openTime,
    backtestTo: candles.at(-1)!.openTime, execution });
  const metrics = calculateBacktestMetrics(result, candles, execution);
  assert.equal(metrics.initialCapital, "55"); assert.equal(metrics.tradeCount, 2);
  assert.ok(Number(metrics.totalFees) > 0); assert.ok(Number(metrics.endingEquity) > 0);
  assert.ok(Number(metrics.maximumDrawdownPct) >= 0); assert.equal(metrics.openPositionCount, 0);
  assert.ok(metrics.averageHoldingTimeMs !== null && metrics.averageHoldingTimeMs > 0);
  assert.notEqual(metrics.buyAndHoldReturnPct, "0");
});

test("run backtest use case loads warm-up, starts, executes, persists, and returns UI data", async () => {
  const bots = new Bots(); const runs = new Runs(); const persistence = new Persistence();
  const strategies = new Strategies(); const repository = new Candles();
  const useCase = new RunBacktestUseCase(bots, strategies, repository,
    new StartBotUseCase(bots, runs, strategies), persistence);
  const response = await useCase.execute("owner", "bot", { from: candles[0].openTime, to: candles.at(-1)!.openTime });
  assert.equal(response.ok, true); if (!response.ok) return;
  assert.equal(runs.values.length, 1); assert.equal(persistence.calls.length, 1);
  assert.equal(response.result.fills.length, 4); assert.equal(response.result.positions.length, 2);
  assert.equal(response.result.metrics.tradeCount, 2);
  assert.equal((await useCase.execute("intruder", "bot", { from: candles[0].openTime,
    to: candles.at(-1)!.openTime })).status, 404);
});

test("Bot API client submits the selected ISO range and returns the UI result", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ backtest: { runId: "run", metrics: { tradeCount: 2 },
      decisions: [], fills: [], events: [], positions: [], openPositions: [] } }),
    { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const result = await new BotApiClient(fetcher as typeof fetch).runBacktest("bot/id", "from", "to");
  assert.equal(result.runId, "run");
  assert.equal(calls[0].url, "/api/bots/bot%2Fid/backtests");
  assert.equal(calls[0].init?.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { from: "from", to: "to" });
});
