import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { buildBacktestPersistencePlan } from "@/src/modules/bot/application/BacktestRunPersistencePlan";
import { runHistoricalBacktest, type BacktestExecutionConfig } from "@/src/modules/bot";
import { PrismaBacktestRunPersistenceRepository } from
  "@/src/modules/bot/infrastructure/prisma/PrismaBacktestRunPersistenceRepository";
import type { Candle } from "@/src/modules/market";
import type { StrategyDefinitionV1 } from "@/src/modules/strategy";

const fixturePath = (...parts: string[]) => join(process.cwd(), "tests", "fixtures", "backtest", ...parts);
const readJson = <T>(fileName: string): T => JSON.parse(readFileSync(fixturePath(fileName), "utf8")) as T;
const iso = (value: Date | null) => value?.toISOString() ?? null;
const json = (value: Prisma.JsonValue) => JSON.parse(JSON.stringify(value)) as unknown;

type SerializedCandle = Omit<Candle, "openTime" | "closeTime" | "receivedAt"> & {
  openTime: string; closeTime: string; receivedAt: string;
};
type ExecutionFixture = { backtestFrom: string; backtestTo: string; configuration: BacktestExecutionConfig };

const sourceCandles = readJson<{ candles: SerializedCandle[] }>("phase4-candles.json").candles;
const definition = readJson<StrategyDefinitionV1>("phase4-strategy.json");
const execution = readJson<ExecutionFixture>("phase4-execution.json");
const applicationGolden = readJson<{ result: unknown }>("phase4-expected-result.json");

const replaceCandleIds = (value: unknown, candleNames: ReadonlyMap<string, string>): unknown => {
  if (typeof value === "string") {
    let normalized = value;
    candleNames.forEach((name, id) => { normalized = normalized.replaceAll(id, name); });
    return normalized;
  }
  if (Array.isArray(value)) return value.map((item) => replaceCandleIds(item, candleNames));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
    .map(([key, item]) => [key, replaceCandleIds(item, candleNames)]));
  return value;
};

test("Phase 4 golden graph persists atomically and is idempotently reusable",
  { skip: !process.env.DATABASE_URL }, async () => {
    const { prisma } = await import("@/src/shared/infrastructure/prisma/prisma");
    const suffix = randomUUID();
    const user = await prisma.user.create({ data: {
      email: `phase4-golden-${suffix}@example.test`, passwordHash: "test",
    } });
    await prisma.pair.upsert({ where: { symbol: "GOLDENUSDC" },
      create: { symbol: "GOLDENUSDC", decimals: 8 }, update: {} });
    const strategy = await prisma.strategy.create({ data: { userId: user.id, name: `phase4-golden-${suffix}`,
      versions: { create: { version: 1, schemaVersion: 1, definition } } }, include: { versions: true } });
    const bot = await prisma.bot.create({ data: { userId: user.id, name: `phase4-golden-${suffix}`,
      pairSymbol: "GOLDENUSDC", assignedBudget: execution.configuration.assignedBudget,
      amountPerPosition: execution.configuration.amountPerPosition, timeframe: "1h",
      feeRate: execution.configuration.feeRate, slippageRate: execution.configuration.slippageRate,
      status: "RUNNING", strategyVersionId: strategy.versions[0].id } });
    const candles: Candle[] = [];
    for (const fixture of sourceCandles) {
      const stored = await prisma.candle.create({ data: { id: randomUUID(), pairSymbol: fixture.pairSymbol,
        interval: fixture.interval, openTime: new Date(fixture.openTime), closeTime: new Date(fixture.closeTime),
        open: fixture.open, high: fixture.high, low: fixture.low, close: fixture.close, volume: fixture.volume,
        quoteVolume: fixture.quoteVolume, trades: fixture.trades, isClosed: fixture.isClosed,
        source: fixture.source, receivedAt: new Date(fixture.receivedAt) } });
      candles.push({ ...stored, interval: stored.interval as Candle["interval"], open: stored.open.toString(),
        high: stored.high.toString(), low: stored.low.toString(), close: stored.close.toString(),
        volume: stored.volume.toString(), quoteVolume: stored.quoteVolume.toString() });
    }
    const from = new Date(execution.backtestFrom);
    const to = new Date(execution.backtestTo);
    const result = runHistoricalBacktest({ definition, candles, backtestFrom: from, backtestTo: to,
      execution: execution.configuration });
    const candleNames = new Map(candles.map((candle, index) => [candle.id, sourceCandles[index].id]));
    assert.deepEqual(replaceCandleIds(JSON.parse(JSON.stringify(result)), candleNames), applicationGolden.result);
    const run = await prisma.botRun.create({ data: { botId: bot.id, mode: "BACKTEST", status: "RUNNING",
      configurationSnapshot: execution.configuration, strategySnapshot: { definition },
      backtestFrom: from, backtestTo: to, ledgerEntries: { create: { type: "ALLOCATION",
        amount: execution.configuration.assignedBudget, balanceAfter: execution.configuration.assignedBudget,
        referenceType: "BOT_RUN", description: "Initial virtual budget allocation" } } } });

    try {
      const repository = new PrismaBacktestRunPersistenceRepository(prisma);
      const persisted = await Promise.all([
        repository.persistCompleted(run.id, result), repository.persistCompleted(run.id, result),
      ]);
      assert.equal(persisted.filter(({ reused }) => reused).length, 1);

      const expected = buildBacktestPersistencePlan(run.id, result);
      const [storedRun, storedBot, positions, orders, fills, ledger, decisions, indicators, events, snapshots] =
        await Promise.all([
          prisma.botRun.findUniqueOrThrow({ where: { id: run.id } }),
          prisma.bot.findUniqueOrThrow({ where: { id: bot.id } }),
          prisma.position.findMany({ where: { botRunId: run.id }, orderBy: { openedAt: "asc" } }),
          prisma.botOrder.findMany({ where: { botRunId: run.id }, orderBy: { submittedAt: "asc" } }),
          prisma.fill.findMany({ where: { botOrder: { botRunId: run.id } }, orderBy: { filledAt: "asc" } }),
          prisma.botLedgerEntry.findMany({ where: { botRunId: run.id }, orderBy: [{ occurredAt: "asc" }, { type: "asc" }] }),
          prisma.strategyDecision.findMany({ where: { botRunId: run.id }, orderBy: { evaluatedAt: "asc" } }),
          prisma.indicatorSnapshot.findMany({ where: { botRunId: run.id }, orderBy: { calculatedAt: "asc" } }),
          prisma.botEvent.findMany({ where: { botRunId: run.id }, orderBy: { sequenceNumber: "asc" } }),
          prisma.portfolioSnapshot.findMany({ where: { botRunId: run.id }, orderBy: { sequenceNumber: "asc" } }),
        ]);

      assert.equal(storedRun.status, "COMPLETED");
      assert.equal(iso(storedRun.endedAt), expected.endedAt.toISOString());
      assert.equal(storedBot.status, "PAUSED");
      assert.deepEqual(positions.map((item) => ({ id: item.id, botRunId: item.botRunId, status: item.status,
        entryCost: item.entryCost.toString(), entryQuantity: item.entryQuantity.toString(),
        remainingQuantity: item.remainingQuantity.toString(), averageEntryPrice: item.averageEntryPrice.toString(),
        averageExitPrice: item.averageExitPrice?.toString() ?? null, fees: item.fees.toString(),
        realizedPnl: item.realizedPnl.toString(), openedAt: item.openedAt, closedAt: item.closedAt })), expected.positions);
      assert.deepEqual(orders.map((item) => ({ id: item.id, botRunId: item.botRunId, positionId: item.positionId!,
        idempotencyKey: item.idempotencyKey, side: item.side, requestedQuoteAmount: item.requestedQuoteAmount?.toString() ?? null,
        requestedQuantity: item.requestedQuantity?.toString() ?? null, executedQuantity: item.executedQuantity.toString(),
        submittedAt: item.submittedAt! })), expected.orders);
      assert.ok(orders.every((order) => order.status === "FILLED" && order.exchangeOrderId === null));
      assert.deepEqual(fills.map((item) => ({ id: item.id, botOrderId: item.botOrderId,
        exchangeTradeId: item.exchangeTradeId!, quantity: item.quantity.toString(), price: item.price.toString(),
        commission: item.commission.toString(), commissionAsset: item.commissionAsset!, filledAt: item.filledAt })), expected.fills);
      assert.deepEqual(ledger.filter(({ type }) => type !== "ALLOCATION").map((item) => ({ id: item.id,
        botRunId: item.botRunId, type: item.type as "BUY_COST" | "SELL_PROCEEDS" | "FEE" | "CORRECTION",
        amount: item.amount.toString(), balanceAfter: item.balanceAfter.toString(), referenceType: item.referenceType!,
        referenceId: item.referenceId!, description: item.description, occurredAt: item.occurredAt })),
      expected.ledgerEntries);
      assert.equal(ledger.filter(({ type }) => type === "ALLOCATION").length, 1);
      assert.deepEqual(decisions.map((item) => ({ id: item.id, botRunId: item.botRunId, candleId: item.candleId,
        action: item.action, reasonCode: item.reasonCode, explanation: item.explanation, inputs: json(item.inputs),
        output: json(item.output), evaluatedAt: item.evaluatedAt })), expected.decisions);
      assert.deepEqual(indicators.map((item) => ({ id: item.id, botRunId: item.botRunId, candleId: item.candleId,
        values: json(item.values), calculatedAt: item.calculatedAt })), expected.indicatorSnapshots);
      assert.deepEqual(events.map((item) => ({ id: item.id, botRunId: item.botRunId,
        sequenceNumber: item.sequenceNumber, eventType: item.eventType, candleOpenTime: item.candleOpenTime,
        payload: json(item.payload), occurredAt: item.occurredAt })), expected.events);
      assert.deepEqual(snapshots.map((item) => ({ id: item.id, botRunId: item.botRunId,
        sequenceNumber: item.sequenceNumber, availableBudget: item.availableBudget.toString(),
        reservedBudget: item.reservedBudget.toString(), investedCost: item.investedCost.toString(),
        marketValue: item.marketValue.toString(), realizedPnl: item.realizedPnl.toString(),
        unrealizedPnl: item.unrealizedPnl.toString(), totalEquity: item.totalEquity.toString(),
        capturedAt: item.capturedAt })), expected.portfolioSnapshots);

      assert.equal(positions.length, 1);
      assert.deepEqual(orders.map(({ side }) => side), ["BUY", "SELL"]);
      assert.equal(decisions[0].reasonCode, "ENTRY_MATCHED");
      assert.deepEqual(events.map(({ sequenceNumber }) => Number(sequenceNumber)),
        Array.from({ length: result.events.length }, (_, index) => index + 1));
      assert.equal(snapshots.at(-1)?.totalEquity.toString(), "55.939364473479612072");
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
      await prisma.candle.deleteMany({ where: { id: { in: candles.map(({ id }) => id) } } });
    }
  });
