import type { ImportSource } from "./ImportTransactionsStoreService";

export function isTransactionNewerThanStored(
  source: ImportSource,
  transactionEpoch: number,
  lastProcessedEpoch: number | null
): boolean {
  if (lastProcessedEpoch === null) {
    return true;
  }

  if (source === "binanceapi") {
    return transactionEpoch > lastProcessedEpoch;
  }

  return transactionEpoch >= lastProcessedEpoch;
}
