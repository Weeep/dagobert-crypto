import { KVRoot } from "@/src/shared/infrastructure/kv/KVRoot";
import type { KeyValueStore } from "@/src/shared/infrastructure/kv/KeyValueStore";
import type { DagobertTransaction } from "../../domain/DagobertTransaction";
import type { TradeType } from "../../domain/TradeType";
import type { TransactionRepository } from "../../domain/TransactionRepository";

/**
 * @deprecated Legacy Redis/KV transaction adapter retained for migration and tests.
 * New features should use Prisma/PostgreSQL only.
 */
export class KvTransactionRepository implements TransactionRepository {
  constructor(private readonly store: KeyValueStore) {}

  async findAll(): Promise<DagobertTransaction[]> {
    const transactions = await this.store.hgetall(KVRoot.dtransactions);
    return Object.values(transactions) as DagobertTransaction[];
  }

  async findById(id: string): Promise<DagobertTransaction | null> {
    const transaction = await this.store.hget(KVRoot.dtransactions, id);
    return transaction === null ? null : (transaction as DagobertTransaction);
  }

  async save(transaction: DagobertTransaction): Promise<void> {
    await this.store.hset(KVRoot.dtransactions, {
      [transaction.orderId]: transaction,
    });
  }

  async saveMany(transactions: DagobertTransaction[]): Promise<void> {
    const transactionsById = transactions.reduce<Record<string, DagobertTransaction>>(
      (result, transaction) => {
        result[transaction.orderId] = transaction;
        return result;
      },
      {}
    );

    if (Object.keys(transactionsById).length > 0) {
      await this.store.hset(KVRoot.dtransactions, transactionsById);
    }
  }

  async getLastProcessedEpoch(
    pair: string,
    tradeType: TradeType
  ): Promise<number | null> {
    const value = await this.store.get(this.lastProcessedEpochKey(pair, tradeType));
    if (value === null) return null;

    const epoch = typeof value === "number" ? value : Number.parseInt(value, 10);
    return Number.isNaN(epoch) ? null : epoch;
  }

  async setLastProcessedEpoch(
    pair: string,
    tradeType: TradeType,
    epoch: number
  ): Promise<void> {
    await this.store.set(this.lastProcessedEpochKey(pair, tradeType), epoch.toString());
  }

  private lastProcessedEpochKey(pair: string, tradeType: TradeType): string {
    return `last_transaction_epoch_${tradeType}_${pair}`;
  }
}
