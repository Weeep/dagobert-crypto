import type { PairRepository } from "@/src/modules/pair/domain/PairRepository";
import type { DagobertTransaction } from "../../domain/DagobertTransaction";
import type { TransactionRepository } from "../../domain/TransactionRepository";
import { TradeType } from "../../domain/TradeType";
import type { ImportTransactionsStoreResult } from "./ImportTransactionsResult";
import { isTransactionNewerThanStored } from "./isTransactionNewerThanStored";

export type ImportSource = "binanceapi" | "binancecsv";

export class ImportTransactionsStoreService {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly pairRepository: PairRepository
  ) {}

  async store(
    dtransactionsPerPair: Record<string, DagobertTransaction[]>,
    tradeType: TradeType,
    source: ImportSource
  ): Promise<ImportTransactionsStoreResult> {
    const info: ImportTransactionsStoreResult = {
      pairInfo: {},
      addedTransactions: [],
    };

    for (const pair in dtransactionsPerPair) {
      info.pairInfo[pair] = { processed: 0, added: 0, skipped: 0 };

      const dtransactions = dtransactionsPerPair[pair];
      dtransactions.sort((a, b) => (a.dateEpoch > b.dateEpoch ? 1 : -1));

      for (const dtransaction of dtransactions) {
        const lastProcessedEpoch = await this.transactionRepository.getLastProcessedEpoch(
          dtransaction.pair,
          tradeType
        );

        if (
          dtransaction.status === "FILLED" &&
          isTransactionNewerThanStored(
            source,
            dtransaction.dateEpoch,
            lastProcessedEpoch
          )
        ) {
          await this.transactionRepository.save(dtransaction);
          await this.transactionRepository.setLastProcessedEpoch(
            dtransaction.pair,
            tradeType,
            dtransaction.dateEpoch
          );
          info.pairInfo[pair].added++;
          info.addedTransactions.push(dtransaction);
        } else {
          info.pairInfo[pair].skipped++;
        }
      }

      info.pairInfo[pair].processed = dtransactions.length;

      if ((await this.pairRepository.findBySymbol(pair)) === null) {
        await this.pairRepository.save({ pair, decimals: 4, keyLevels: [] });
      }
    }

    return info;
  }
}
