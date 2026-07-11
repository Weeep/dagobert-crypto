import ClientSideDbCache from "@/app/lib/ClientSideDbCache";
import { KVRoot } from "@/src/shared/infrastructure/kv/KVRoot";
import type { DagobertTransaction } from "../domain/DagobertTransaction";
import type { TransactionRepository } from "../domain/TransactionRepository";
import type { TradeType } from "../domain/TradeType";

export class ClientSideDbTransactionRepository implements TransactionRepository {
  findAll(): Promise<DagobertTransaction[]> {
    return Promise.resolve(
      Object.values(ClientSideDbCache.hgetall(KVRoot.dtransactions) ?? {}) as DagobertTransaction[]
    );
  }

  findById(id: string): Promise<DagobertTransaction | null> {
    return Promise.resolve(
      ClientSideDbCache.hget(KVRoot.dtransactions, id) as DagobertTransaction | null
    );
  }

  async save(transaction: DagobertTransaction): Promise<void> {
    await ClientSideDbCache.hset(KVRoot.dtransactions, {
      [transaction.orderId]: transaction,
    });
  }

  async saveMany(transactions: DagobertTransaction[]): Promise<void> {
    const transactionsById = transactions.reduce<Record<string, DagobertTransaction>>(
      (acc, transaction) => {
        acc[transaction.orderId] = transaction;
        return acc;
      },
      {}
    );

    if (Object.keys(transactionsById).length > 0) {
      await ClientSideDbCache.hset(KVRoot.dtransactions, transactionsById);
    }
  }

  findLastImportedEpoch(tradeType: TradeType, pair: string): Promise<number | null> {
    const value = ClientSideDbCache.get(this.lastImportedEpochKey(tradeType, pair));
    return Promise.resolve(value ? parseInt(value, 10) : null);
  }

  async saveLastImportedEpoch(
    tradeType: TradeType,
    pair: string,
    epoch: number
  ): Promise<void> {
    await ClientSideDbCache.set(
      this.lastImportedEpochKey(tradeType, pair),
      epoch.toString()
    );
  }

  private lastImportedEpochKey(tradeType: TradeType, pair: string): string {
    return `last_transaction_epoch_${tradeType}_${pair}`;
  }
}
