import type { DagobertPair } from "../domain/DagobertPair";

export type PairMutationResult =
  | { ok: true; error: ""; pair: DagobertPair }
  | { ok: false; error: string; pair: null };

export type DeletePairResult =
  | { ok: true; error: "" }
  | { ok: false; error: string };

export type CreatePairsFromTransactionsResult = {
  ok: boolean;
  error: string;
  createdPairs: DagobertPair[];
  skippedPairs: DagobertPair[];
};
