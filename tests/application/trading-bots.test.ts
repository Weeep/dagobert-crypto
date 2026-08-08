import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { CreateBotUseCase, StartBotUseCase, type BotRepository, type BotRun, type BotRunRepository, type TradingBot } from "@/src/modules/bot";
import { CreateStrategyUseCase, type Strategy, type StrategyRepository, type StrategyVersion } from "@/src/modules/strategy";

class MemoryBotRepository implements BotRepository {
  bots: TradingBot[] = [];
  async findAllByUserId(userId: string) { return this.bots.filter((bot) => bot.userId === userId); }
  async findById(id: string) { return this.bots.find((bot) => bot.id === id) ?? null; }
  async findByUserIdAndName(userId: string, name: string) {
    return this.bots.find((bot) => bot.userId === userId && bot.name === name) ?? null;
  }
  async save(bot: TradingBot) { this.bots = [...this.bots.filter((item) => item.id !== bot.id), bot]; }
}
class MemoryRunRepository implements BotRunRepository {
  runs: BotRun[] = [];
  async findById(id: string) { return this.runs.find((run) => run.id === id) ?? null; }
  async findAllByBotId(botId: string) { return this.runs.filter((run) => run.botId === botId); }
  async save(run: BotRun) { this.runs.push(run); }
}
class MemoryStrategyRepository implements StrategyRepository {
  strategies: Strategy[] = [];
  async findAllByUserId(userId: string) { return this.strategies.filter((strategy) => strategy.userId === userId); }
  async findById(id: string) { return this.strategies.find((strategy) => strategy.id === id) ?? null; }
  async findVersionById(id: string): Promise<StrategyVersion | null> {
    return this.strategies.flatMap((strategy) => strategy.versions).find((version) => version.id === id) ?? null;
  }
  async save(strategy: Strategy) { this.strategies.push(strategy); }
  async addVersion(version: StrategyVersion) {
    const strategy = await this.findById(version.strategyId);
    if (strategy) strategy.versions.push(version);
  }
}

describe("trading bot application", () => {
  test("creates only valid USDC bots with normalized decimal configuration", async () => {
    const repository = new MemoryBotRepository();
    const useCase = new CreateBotUseCase(repository);
    const invalid = await useCase.execute({ userId: "user", name: "Bad", pairSymbol: "BTCEUR",
      assignedBudget: "55", amountPerPosition: "10", timeframe: "1h", strategyVersionId: "strategy" });
    assert.equal(invalid.ok, false);

    const result = await useCase.execute({ userId: "user", name: " RSI bot ", pairSymbol: "btcusdc",
      assignedBudget: "55.00", amountPerPosition: "10.0", timeframe: "4h",
      strategyVersionId: "strategy", feeRate: "0.001", slippageRate: "0.0005" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.bot.name, "RSI bot");
    assert.equal(result.bot.pairSymbol, "BTCUSDC");
    assert.equal(result.bot.assignedBudget, "55");
    assert.equal(result.bot.amountPerPosition, "10");
    assert.equal(repository.bots.length, 1);
  });

  test("creates an immutable strategy version and snapshots it when a backtest starts", async () => {
    const strategies = new MemoryStrategyRepository();
    const strategyResult = await new CreateStrategyUseCase(strategies).execute({
      userId: "user", name: "RSI", definition: { entry: { indicator: "RSI" } },
    });
    assert.equal(strategyResult.ok, true);
    if (!strategyResult.ok) return;

    const bots = new MemoryBotRepository();
    const botResult = await new CreateBotUseCase(bots).execute({
      userId: "user", name: "Bot", pairSymbol: "ETHUSDC", assignedBudget: "55",
      amountPerPosition: "10", timeframe: "1h", strategyVersionId: strategyResult.strategy.versions[0].id,
    });
    assert.equal(botResult.ok, true);
    if (!botResult.ok) return;

    const runs = new MemoryRunRepository();
    const start = await new StartBotUseCase(bots, runs, strategies).execute(botResult.bot.id, {
      from: new Date("2025-01-01T00:00:00Z"), to: new Date("2025-02-01T00:00:00Z"),
    });
    assert.equal(start.ok, true);
    if (!start.ok) return;
    assert.deepEqual(start.run.strategySnapshot, strategyResult.strategy.versions[0]);
    assert.equal((await bots.findById(botResult.bot.id))?.status, "RUNNING");
    assert.equal(runs.runs.length, 1);
  });
});
