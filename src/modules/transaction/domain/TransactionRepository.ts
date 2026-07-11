import type { DagobertTransaction } from "./DagobertTransaction";
import type { TradeType } from "./TradeType";

export interface TransactionRepository {
  findAll(): Promise<DagobertTransaction[]>;
  findById(id: string): Promise<DagobertTransaction | null>;
  save(transaction: DagobertTransaction): Promise<void>;
  saveMany(transactions: DagobertTransaction[]): Promise<void>;
  getLastProcessedEpoch(pair: string, tradeType: TradeType): Promise<number | null>;
  setLastProcessedEpoch(pair: string, tradeType: TradeType, epoch: number): Promise<void>;
}
