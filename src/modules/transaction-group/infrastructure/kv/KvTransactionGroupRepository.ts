import ClientSideDbCache from "@/app/lib/ClientSideDbCache";
import { KVRoot } from "@/src/shared/infrastructure/kv/KVRoot";
import type { DagobertTransactionGroup } from "../../domain/DagobertTransactionGroup";
import type { TransactionGroupRepository } from "../../domain/TransactionGroupRepository";

export class KvTransactionGroupRepository implements TransactionGroupRepository {
  findAll(): Promise<DagobertTransactionGroup[]> {
    return Promise.resolve(
      Object.values(
        ClientSideDbCache.hgetall(KVRoot.dtransactionGroups) ?? {}
      ) as DagobertTransactionGroup[]
    );
  }

  findById(id: string): Promise<DagobertTransactionGroup | null> {
    return Promise.resolve(
      ClientSideDbCache.hget(
        KVRoot.dtransactionGroups,
        id
      ) as DagobertTransactionGroup | null
    );
  }

  async save(group: DagobertTransactionGroup): Promise<void> {
    if (!group.groupId) {
      throw new Error("Cannot save transaction group without groupId");
    }

    await ClientSideDbCache.hset(KVRoot.dtransactionGroups, {
      [group.groupId]: group,
    });
  }

  async delete(id: string): Promise<void> {
    await ClientSideDbCache.hdel(KVRoot.dtransactionGroups, id);
  }
}
