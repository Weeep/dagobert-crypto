import type { DagobertTransaction } from "./DagobertTransaction";
import type { TradeType } from "./TradeType";

export interface TransactionRepository {
  findAll(): Promise<DagobertTransaction[]>;
  findById(id: string): Promise<DagobertTransaction | null>;
  save(transaction: DagobertTransaction): Promise<void>;
  saveMany(transactions: DagobertTransaction[]): Promise<void>;
  findLastImportedEpoch(tradeType: TradeType, pair: string): Promise<number | null>;
  saveLastImportedEpoch(tradeType: TradeType, pair: string, epoch: number): Promise<void>;
}
