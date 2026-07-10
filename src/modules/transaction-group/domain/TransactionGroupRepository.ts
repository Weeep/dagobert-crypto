import type { DagobertTransactionGroup } from "./DagobertTransactionGroup";

export interface TransactionGroupRepository {
  findAll(): Promise<DagobertTransactionGroup[]>;
  findById(id: string): Promise<DagobertTransactionGroup | null>;
  save(group: DagobertTransactionGroup): Promise<void>;
  delete(id: string): Promise<void>;
}
