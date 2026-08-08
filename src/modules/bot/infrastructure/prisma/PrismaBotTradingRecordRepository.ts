import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  BotEvent, BotLedgerEntry, BotOrder, BotTradingRecordRepository, Fill,
  IndicatorSnapshot, PortfolioSnapshot, Position, StrategyDecision,
} from "@/src/modules/bot";

const json = (value: unknown) => value as Prisma.InputJsonValue;

export class PrismaBotTradingRecordRepository implements BotTradingRecordRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async savePosition(value: Position) {
    const data = { botRunId: value.botRunId, status: value.status, entryCost: value.entryCost,
      entryQuantity: value.entryQuantity, remainingQuantity: value.remainingQuantity,
      averageEntryPrice: value.averageEntryPrice, averageExitPrice: value.averageExitPrice,
      fees: value.fees, realizedPnl: value.realizedPnl, openedAt: value.openedAt, closedAt: value.closedAt };
    await this.prisma.position.upsert({ where: { id: value.id }, create: { id: value.id, ...data }, update: data });
  }
  async saveOrder(value: BotOrder) {
    const data = { botRunId: value.botRunId, positionId: value.positionId,
      idempotencyKey: value.idempotencyKey, exchangeOrderId: value.exchangeOrderId,
      side: value.side, status: value.status, requestedQuoteAmount: value.requestedQuoteAmount,
      requestedQuantity: value.requestedQuantity, executedQuantity: value.executedQuantity,
      submittedAt: value.submittedAt };
    await this.prisma.botOrder.upsert({ where: { id: value.id }, create: { id: value.id, ...data }, update: data });
  }
  async saveFill(value: Fill) {
    const data = { botOrderId: value.botOrderId, exchangeTradeId: value.exchangeTradeId,
      quantity: value.quantity, price: value.price, commission: value.commission,
      commissionAsset: value.commissionAsset, filledAt: value.filledAt };
    await this.prisma.fill.upsert({ where: { id: value.id }, create: { id: value.id, ...data }, update: data });
  }
  async appendLedgerEntry(value: BotLedgerEntry) {
    await this.prisma.botLedgerEntry.create({ data: { ...value, amount: value.amount, balanceAfter: value.balanceAfter } });
  }
  async saveDecision(value: StrategyDecision) {
    const data = { botRunId: value.botRunId, candleId: value.candleId, action: value.action,
      reasonCode: value.reasonCode, explanation: value.explanation, inputs: json(value.inputs),
      output: json(value.output), evaluatedAt: value.evaluatedAt };
    await this.prisma.strategyDecision.upsert({ where: { id: value.id }, create: { id: value.id, ...data }, update: data });
  }
  async appendEvent(value: BotEvent) {
    await this.prisma.botEvent.create({ data: { ...value, payload: json(value.payload) } });
  }
  async saveIndicatorSnapshot(value: IndicatorSnapshot) {
    const data = { botRunId: value.botRunId, candleId: value.candleId,
      values: json(value.values), calculatedAt: value.calculatedAt };
    await this.prisma.indicatorSnapshot.upsert({ where: { id: value.id }, create: { id: value.id, ...data }, update: data });
  }
  async savePortfolioSnapshot(value: PortfolioSnapshot) {
    await this.prisma.portfolioSnapshot.upsert({
      where: { id: value.id }, create: { ...value }, update: { ...value },
    });
  }
}
