import { KVRoot } from "@/src/shared/infrastructure/kv/KVRoot";
import type { KeyValueStore } from "@/src/shared/infrastructure/kv/KeyValueStore";
import type { DagobertTransactionGroup } from "../../domain/DagobertTransactionGroup";
import type { TransactionGroupRepository } from "../../domain/TransactionGroupRepository";

/**
 * @deprecated Legacy Redis/KV transaction-group adapter retained for migration
 * and tests. New features should use Prisma/PostgreSQL only.
 */
export class KvTransactionGroupRepository implements TransactionGroupRepository {
  constructor(private readonly store: KeyValueStore) {}

  async findAll(): Promise<DagobertTransactionGroup[]> {
    const groups = await this.store.hgetall(KVRoot.dtransactionGroups);
    return Object.values(groups) as DagobertTransactionGroup[];
  }

  async findById(id: string): Promise<DagobertTransactionGroup | null> {
    const group = await this.store.hget(KVRoot.dtransactionGroups, id);
    return group === null ? null : (group as DagobertTransactionGroup);
  }

  async save(group: DagobertTransactionGroup): Promise<void> {
    if (!group.groupId) {
      throw new Error("Cannot save transaction group without groupId");
    }

    await this.store.hset(KVRoot.dtransactionGroups, {
      [group.groupId]: group,
    });
  }

  async delete(id: string): Promise<void> {
    await this.store.hdel(KVRoot.dtransactionGroups, id);
  }
}
