import type {
  BotEvent,
  BotLedgerEntry,
  BotOrder,
  Fill,
  IndicatorSnapshot,
  PortfolioSnapshot,
  Position,
  StrategyDecision,
} from "./TradingBot";

/** Persistence boundary for append-only and worker-owned trading records. */
export interface BotTradingRecordRepository {
  savePosition(position: Position): Promise<void>;
  saveOrder(order: BotOrder): Promise<void>;
  saveFill(fill: Fill): Promise<void>;
  appendLedgerEntry(entry: BotLedgerEntry): Promise<void>;
  saveDecision(decision: StrategyDecision): Promise<void>;
  appendEvent(event: BotEvent): Promise<void>;
  saveIndicatorSnapshot(snapshot: IndicatorSnapshot): Promise<void>;
  savePortfolioSnapshot(snapshot: PortfolioSnapshot): Promise<void>;
}
