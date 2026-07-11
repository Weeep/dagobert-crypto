import type { DagobertTransaction } from "../../domain/DagobertTransaction";

export type ImportTransactionsPairInfo = Record<
  string,
  { processed: number; added: number; skipped: number }
>;

export type ImportTransactionsStoreResult = {
  pairInfo: ImportTransactionsPairInfo;
  addedTransactions: DagobertTransaction[];
};

export type ImportTransactionsResult = {
  ok: boolean;
  error: string;
  response: ImportTransactionsStoreResult | null;
};
