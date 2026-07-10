import type { DagobertTransaction } from "./DagobertTransaction";

export interface TransactionRepository {
  findAll(): Promise<DagobertTransaction[]>;
  findById(id: string): Promise<DagobertTransaction | null>;
  save(transaction: DagobertTransaction): Promise<void>;
  saveMany(transactions: DagobertTransaction[]): Promise<void>;
}
