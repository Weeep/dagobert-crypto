import assert from "node:assert/strict";
import test, { describe } from "node:test";
import type { BotRepository, BotRun, BotRunRepository, TradingBot } from "@/src/modules/bot";
import type { Candle } from "@/src/modules/market";
import {
  ActivateStrategyVersionUseCase,
  EvaluateStrategyForClosedCandleUseCase,
  type ClosedCandleHistoryRepository,
  type PersistedStrategyEvaluation,
  type Strategy,
  type StrategyEvaluationRepository,
  type StrategyRepository,
  type StrategyVersion,
} from "@/src/modules/strategy";

const definition = { schemaVersion: 1 as const, name: "Lifecycle",
  entry: { all: [{ candleSequence: { count: 1, direction: "RED" as const, minimumBodyChangePct: 0 } }] },
  exit: { all: [{ candleSequence: { count: 1, direction: "GREEN" as const, minimumBodyChangePct: 0 } }] } };
const candle: Candle = { id: "candle", pairSymbol: "BTCUSDC", interval: "1h",
  openTime: new Date("2026-01-01T00:00:00Z"), closeTime: new Date("2026-01-01T00:59:59.999Z"),
  open: "101", high: "102", low: "98", close: "99", volume: "1", quoteVolume: "100",
  trades: 1, isClosed: true, source: "TEST", receivedAt: new Date("2026-01-01T01:00:00Z") };
const run: BotRun = { id: "run", botId: "bot", mode: "PAPER", status: "RUNNING",
  configurationSnapshot: { pairSymbol: "BTCUSDC", timeframe: "1h" },
  strategySnapshot: { schemaVersion: 1, definition }, backtestFrom: null, backtestTo: null,
  startedAt: new Date(), endedAt: null, errorMessage: null };

class Runs implements BotRunRepository {
  findById(id: string) { return Promise.resolve(id === run.id ? run : null); }
  findAllByBotId() { return Promise.resolve([run]); }
  save() { return Promise.resolve(); }
}
class History implements ClosedCandleHistoryRepository {
  values = [candle]; calls: number[] = []; unbounded = false;
  findById(id: string) { return Promise.resolve(this.values.find((item) => item.id === id) ?? null); }
  findClosedHistoryEndingAt(_symbol: string, _interval: string, through: Date, limit: number) {
    this.calls.push(limit);
    return Promise.resolve((this.unbounded ? this.values :
      this.values.filter((item) => item.isClosed && item.openTime <= through)).slice(-limit));
  }
}
class Evaluations implements StrategyEvaluationRepository {
  stored: PersistedStrategyEvaluation | null = null; activePositions = 0; saves = 0;
  findByRunAndCandle() { return Promise.resolve(this.stored); }
  findActivePositions() { return Promise.resolve(Array.from({ length: this.activePositions }, (_, index) => ({
    id: `position-${index}`, entryPrice: "100", quantity: "1", entryCost: "100",
    entryFees: "0", openedAt: candle.openTime.toISOString(),
  }))); }
  saveIfAbsent(value: PersistedStrategyEvaluation) { this.saves += 1; this.stored ??= value; return Promise.resolve(this.stored); }
}

class Bots implements BotRepository {
  values: TradingBot[] = [];
  findAllByUserId(userId: string) { return Promise.resolve(this.values.filter((item) => item.userId === userId)); }
  findById(id: string) { return Promise.resolve(this.values.find((item) => item.id === id) ?? null); }
  findByUserIdAndName(userId: string, name: string) { return Promise.resolve(this.values.find((item) => item.userId === userId && item.name === name) ?? null); }
  async save(bot: TradingBot) { this.values = [...this.values.filter((item) => item.id !== bot.id), bot]; }
  async delete(id: string) { this.values = this.values.filter((item) => item.id !== id); }
}
class Strategies implements StrategyRepository {
  values: Strategy[] = [];
  findAllByUserId(userId: string) { return Promise.resolve(this.values.filter((item) => item.userId === userId)); }
  findById(id: string) { return Promise.resolve(this.values.find((item) => item.id === id) ?? null); }
  findVersionById(id: string) { return Promise.resolve(this.values.flatMap((item) => item.versions).find((item) => item.id === id) ?? null); }
  async save(strategy: Strategy) { this.values.push(strategy); }
  async createNextVersion(strategyId: string, value: StrategyVersion["definition"], schemaVersion: number, createdAt: Date) {
    const strategy = await this.findById(strategyId); if (!strategy) throw new Error();
    const version = { id: `v${strategy.versions.length + 1}`, strategyId, version: strategy.versions.length + 1,
      schemaVersion, definition: value, createdAt }; strategy.versions.push(version); return version;
  }
}

describe("closed-candle strategy evaluation application service", () => {
  test("loads bounded closed history and atomically records BUY inputs, output, and indicators", async () => {
    const history = new History(); const evaluations = new Evaluations();
    const useCase = new EvaluateStrategyForClosedCandleUseCase(new Runs(), history, evaluations,
      () => new Date("2026-01-01T01:00:01Z"));
    const result = await useCase.execute("run", "candle");
    assert.equal(result.ok, true); if (!result.ok) return;
    assert.equal(result.evaluation.decision.action, "BUY");
    assert.equal(result.evaluation.decision.reasonCode, "ENTRY_MATCHED");
    assert.deepEqual(history.calls, [1]);
    assert.equal(evaluations.saves, 1);
    assert.deepEqual((result.evaluation.decision.inputs as { strategySnapshot: unknown }).strategySnapshot,
      run.strategySnapshot);
    assert.ok((result.evaluation.indicatorSnapshot.values as { entry: unknown }).entry);
    assert.equal(((result.evaluation.decision.output as { position: { exitFeeRate: string } })
      .position.exitFeeRate), "0");

    const repeated = await useCase.execute("run", "candle");
    assert.equal(repeated.ok, true); assert.equal(repeated.reused, true);
    assert.equal(evaluations.saves, 1);
  });

  test("rejects open targets and malicious future history without persistence", async () => {
    const history = new History(); const evaluations = new Evaluations();
    history.values = [{ ...candle, isClosed: false }];
    const useCase = new EvaluateStrategyForClosedCandleUseCase(new Runs(), history, evaluations);
    assert.equal((await useCase.execute("run", "candle")).ok, false);
    history.values = [candle, { ...candle, id: "future", openTime: new Date("2026-01-01T01:00:00Z"),
      closeTime: new Date("2026-01-01T01:59:59.999Z") }];
    history.unbounded = true;
    assert.equal((await useCase.execute("run", "candle")).ok, false);
    assert.equal(evaluations.saves, 0);
  });
});

describe("strategy version activation", () => {
  test("activates only an owned valid version on a non-running owned bot", async () => {
    const now = new Date(); const bots = new Bots(); const strategies = new Strategies();
    bots.values.push({ id: "bot", userId: "owner", name: "Bot", pairSymbol: "BTCUSDC", assignedBudget: "20",
      amountPerPosition: "10", timeframe: "1h", mode: "BACKTEST", status: "DRAFT",
      strategyVersionId: "v1", feeRate: "0", slippageRate: "0", createdAt: now, updatedAt: now });
    strategies.values.push({ id: "strategy", userId: "owner", name: "Strategy", description: "",
      versions: [{ id: "v1", strategyId: "strategy", version: 1, schemaVersion: 1, definition, createdAt: now },
        { id: "v2", strategyId: "strategy", version: 2, schemaVersion: 1, definition: { ...definition, name: "v2" }, createdAt: now }],
      createdAt: now, updatedAt: now });
    strategies.values.push({ id: "foreign", userId: "other", name: "Foreign", description: "",
      versions: [{ id: "foreign-v1", strategyId: "foreign", version: 1, schemaVersion: 1,
        definition, createdAt: now }], createdAt: now, updatedAt: now });
    const useCase = new ActivateStrategyVersionUseCase(bots, strategies);
    const activated = await useCase.execute("owner", "bot", "v2");
    assert.equal(activated.ok, true); if (activated.ok) assert.equal(activated.bot.strategyVersionId, "v2");
    assert.equal((await useCase.execute("other", "bot", "v1")).ok, false);
    assert.equal((await useCase.execute("owner", "bot", "foreign-v1")).ok, false);
    bots.values[0].status = "RUNNING";
    assert.equal((await useCase.execute("owner", "bot", "v1")).ok, false);
  });
});
