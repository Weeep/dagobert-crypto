import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { CreateBotUseCase, DeleteBotUseCase, GetBotUseCase, ListBotsUseCase, SetBotStatusUseCase, StartBotUseCase, UpdateBotUseCase, type BotRepository, type BotRun, type BotRunRepository, type TradingBot } from "@/src/modules/bot";
import { CreateStrategyUseCase, type Strategy, type StrategyRepository, type StrategyVersion } from "@/src/modules/strategy";

const validDefinition = (name = "RSI") => ({
  schemaVersion: 1 as const,
  name,
  entry: { all: [{ indicator: "RSI" as const, period: 14, operator: "LT" as const, value: 20 }] },
  exit: { all: [{ indicator: "RSI" as const, period: 14, operator: "GTE" as const, value: 80 }] },
});

class MemoryBotRepository implements BotRepository {
  bots: TradingBot[] = [];
  async findAllByUserId(userId: string) { return this.bots.filter((bot) => bot.userId === userId); }
  async findById(id: string) { return this.bots.find((bot) => bot.id === id) ?? null; }
  async findByUserIdAndName(userId: string, name: string) {
    return this.bots.find((bot) => bot.userId === userId && bot.name === name) ?? null;
  }
  async save(bot: TradingBot) { this.bots = [...this.bots.filter((item) => item.id !== bot.id), bot]; }
  async delete(id: string) { this.bots = this.bots.filter((item) => item.id !== id); }
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
  async createNextVersion(strategyId: string, definition: StrategyVersion["definition"], schemaVersion: number, createdAt: Date) {
    const strategy = await this.findById(strategyId); if (!strategy) throw new Error("Strategy not found");
    const version = { id: `version-${strategy.versions.length + 1}`, strategyId,
      version: Math.max(0, ...strategy.versions.map((item) => item.version)) + 1,
      schemaVersion, definition, createdAt };
    strategy.versions.push(version); return version;
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
      assignedBudget: "55.00", amountPerPosition: "10.0", timeframe: "15m",
      strategyVersionId: "strategy", feeRate: "0.001", slippageRate: "0.0005" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.bot.name, "RSI bot");
    assert.equal(result.bot.pairSymbol, "BTCUSDC");
    assert.equal(result.bot.assignedBudget, "55");
    assert.equal(result.bot.amountPerPosition, "10");
    assert.equal(result.bot.timeframe, "15m");
    assert.equal(repository.bots.length, 1);
    assert.equal((await new GetBotUseCase(repository).execute("user", result.bot.id))?.status, "DRAFT");
    assert.equal((await new GetBotUseCase(repository).execute("another-user", result.bot.id)), null);
    assert.deepEqual((await new ListBotsUseCase(repository).execute("user")).map((bot) => bot.id), [result.bot.id]);
  });

  test("creates an immutable strategy version and snapshots it when a backtest starts", async () => {
    const strategies = new MemoryStrategyRepository();
    const strategyResult = await new CreateStrategyUseCase(strategies).execute({
      userId: "user", name: "RSI", definition: validDefinition(),
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
    assert.deepEqual(start.run.strategySnapshot, { ...strategyResult.strategy.versions[0], createdAt: strategyResult.strategy.versions[0].createdAt.toISOString() });
    assert.equal((await bots.findById(botResult.bot.id))?.status, "RUNNING");
    assert.equal(runs.runs.length, 1);

    strategyResult.strategy.versions[0].definition = validDefinition("Changed");
    botResult.bot.name = "Changed after start";
    assert.deepEqual((start.run.strategySnapshot as { definition: unknown }).definition, validDefinition());
    assert.equal((start.run.configurationSnapshot as { name: string }).name, "Bot");

    const repeatedStart = await new StartBotUseCase(bots, runs, strategies).execute(botResult.bot.id, {
      from: new Date("2025-03-01T00:00:00Z"), to: new Date("2025-04-01T00:00:00Z"),
    });
    assert.equal(repeatedStart.ok, true);
    if (repeatedStart.ok) assert.equal(repeatedStart.run.id, start.run.id);
    assert.equal(runs.runs.length, 1);
  });

  test("treats position amount as the fee-inclusive cash cap", async () => {
    const useCase = new CreateBotUseCase(new MemoryBotRepository());
    const base = { userId: "user", name: "Fee bot", pairSymbol: "BTCUSDC", assignedBudget: "10",
      amountPerPosition: "10", timeframe: "1h", strategyVersionId: "strategy", feeRate: "0.001" };
    assert.equal((await useCase.execute(base)).ok, true);
    assert.equal((await useCase.execute({ ...base, name: "Overflow", amountPerPosition: "10.01" })).ok, false);
    assert.equal((await useCase.execute({ ...base, name: "Zero", assignedBudget: "0" })).ok, false);
    assert.equal((await useCase.execute({ ...base, name: "Negative", amountPerPosition: "-1" })).ok, false);
    assert.equal((await useCase.execute({ ...base, name: "Malformed", assignedBudget: "not-a-decimal" })).ok, false);
    assert.equal((await useCase.execute({ ...base, name: "Slippage", slippageRate: "1" })).ok, false);
  });

  test("validates strategy ownership and sequential mode transitions on update", async () => {
    const bots = new MemoryBotRepository();
    const created = await new CreateBotUseCase(bots).execute({ userId: "owner", name: "Mode bot", pairSymbol: "BTCUSDC",
      assignedBudget: "20", amountPerPosition: "10", timeframe: "1h", strategyVersionId: "v1" });
    assert.equal(created.ok, true); if (!created.ok) return;
    const updates = new UpdateBotUseCase(bots, async (id) => id === "v2" ? "owner" : null);
    assert.equal((await updates.execute("owner", created.bot.id, { mode: "SPOT_LIVE", strategyVersionId: "v2" })).ok, false);
    assert.equal((await updates.execute("owner", created.bot.id, { mode: "PAPER", strategyVersionId: "foreign" })).ok, false);
    assert.equal((await updates.execute("owner", created.bot.id, { mode: "PAPER", strategyVersionId: "v2" })).ok, true);
  });

  test("new bots start at BACKTEST and create/update reject unknown USDC symbols", async () => {
    const bots = new MemoryBotRepository();
    const pairExists = async (symbol: string) => symbol === "BTCUSDC";
    const create = new CreateBotUseCase(bots, async () => "owner", pairExists);
    const base = { userId: "owner", name: "Validated", pairSymbol: "BTCUSDC", assignedBudget: "20",
      amountPerPosition: "10", timeframe: "1h", strategyVersionId: "v1" } as const;
    assert.equal((await create.execute({ ...base, mode: "SPOT_LIVE" })).ok, false);
    assert.equal((await create.execute({ ...base, pairSymbol: "FAKEUSDC" })).ok, false);
    const created = await create.execute(base); assert.equal(created.ok, true); if (!created.ok) return;
    assert.equal(created.bot.mode, "BACKTEST");
    const update = new UpdateBotUseCase(bots, async () => "owner", pairExists);
    assert.equal((await update.execute("owner", created.bot.id, { pairSymbol: "FAKEUSDC" })).ok, false);
  });

  test("rejects invalid backtest timestamps before persistence", async () => {
    const strategies = new MemoryStrategyRepository();
    const strategy = await new CreateStrategyUseCase(strategies).execute({ userId: "owner", name: "Dates", definition: validDefinition("Dates") });
    assert.equal(strategy.ok, true); if (!strategy.ok) return;
    const bots = new MemoryBotRepository();
    const created = await new CreateBotUseCase(bots).execute({ userId: "owner", name: "Dates", pairSymbol: "BTCUSDC",
      assignedBudget: "20", amountPerPosition: "10", timeframe: "1h", strategyVersionId: strategy.strategy.versions[0].id });
    assert.equal(created.ok, true); if (!created.ok) return;
    const runs = new MemoryRunRepository();
    const result = await new StartBotUseCase(bots, runs, strategies).execute(created.bot.id,
      { from: new Date("invalid"), to: new Date("2025-01-01T00:00:00Z") });
    assert.equal(result.ok, false); assert.equal(runs.runs.length, 0);
  });

  test("does not activate a persisted invalid or unsupported strategy version", async () => {
    const strategies = new MemoryStrategyRepository();
    const createdStrategy = await new CreateStrategyUseCase(strategies).execute({
      userId: "owner", name: "Activation", definition: validDefinition("Activation"),
    });
    assert.equal(createdStrategy.ok, true); if (!createdStrategy.ok) return;
    (createdStrategy.strategy.versions[0] as { definition: unknown }).definition = {
      ...validDefinition(), entry: { indicator: "RSI", period: 14, operator: "EXEC", value: 20 },
    };
    const bots = new MemoryBotRepository();
    const createdBot = await new CreateBotUseCase(bots).execute({
      userId: "owner", name: "Invalid strategy", pairSymbol: "BTCUSDC", assignedBudget: "20",
      amountPerPosition: "10", timeframe: "1h", strategyVersionId: createdStrategy.strategy.versions[0].id,
    });
    assert.equal(createdBot.ok, true); if (!createdBot.ok) return;
    const runs = new MemoryRunRepository();
    const start = await new StartBotUseCase(bots, runs, strategies).execute(createdBot.bot.id, {
      from: new Date("2025-01-01T00:00:00Z"), to: new Date("2025-02-01T00:00:00Z"),
    });
    assert.equal(start.ok, false);
    assert.match(start.error, /invalid or unsupported/);
    assert.equal(runs.runs.length, 0);
  });

  test("pause and stop lifecycle operations are idempotent", async () => {
    const bots = new MemoryBotRepository();
    const now = new Date();
    bots.bots.push({ id: "bot", userId: "owner", name: "Lifecycle", pairSymbol: "BTCUSDC", assignedBudget: "20",
      amountPerPosition: "10", timeframe: "1h", mode: "PAPER", status: "RUNNING", strategyVersionId: "v1",
      feeRate: "0", slippageRate: "0", createdAt: now, updatedAt: now });
    const lifecycle = new SetBotStatusUseCase(bots);
    assert.equal((await lifecycle.execute("bot", "PAUSED")).ok, true);
    assert.equal((await lifecycle.execute("bot", "PAUSED")).ok, true);
    assert.equal((await lifecycle.execute("bot", "STOPPED")).ok, true);
    assert.equal((await lifecycle.execute("bot", "STOPPED")).ok, true);
    assert.equal((await bots.findById("bot"))?.status, "STOPPED");
  });

  test("archives editable bots and permanently deletes only owned, non-running bots", async () => {
    const bots = new MemoryBotRepository();
    const created = await new CreateBotUseCase(bots).execute({ userId: "owner", name: "Retirable", pairSymbol: "BTCUSDC",
      assignedBudget: "20", amountPerPosition: "10", timeframe: "1h", strategyVersionId: "v1" });
    assert.equal(created.ok, true); if (!created.ok) return;
    const archived = await new UpdateBotUseCase(bots, async () => "owner").execute("owner", created.bot.id, { archived: true });
    assert.equal(archived.ok, true); if (!archived.ok) return;
    assert.ok(archived.bot.archivedAt instanceof Date);
    const deletion = new DeleteBotUseCase(bots);
    assert.equal((await deletion.execute("intruder", created.bot.id)).ok, false);
    assert.equal((await deletion.execute("owner", created.bot.id)).ok, true);
    assert.equal(await bots.findById(created.bot.id), null);
  });
});
