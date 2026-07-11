import type { DagobertTransaction } from "../domain/DagobertTransaction";

export type TransactionMutationResult =
  | { ok: true; error: ""; transaction: DagobertTransaction }
  | { ok: false; error: string; transaction: null };
