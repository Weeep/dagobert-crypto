import { KVRoot } from "@/src/shared/infrastructure/kv/KVRoot";
import type { KeyValueStore } from "@/src/shared/infrastructure/kv/KeyValueStore";
import type { DagobertPair } from "../../domain/DagobertPair";
import type { PairRepository } from "../../domain/PairRepository";

/** Redis/KV adapter for server-side composition roots. */
export class KvPairRepository implements PairRepository {
  constructor(private readonly store: KeyValueStore) {}

  async findAll(): Promise<DagobertPair[]> {
    const pairs = await this.store.hgetall(KVRoot.pairs);
    return Object.values(pairs) as DagobertPair[];
  }

  async findBySymbol(symbol: string): Promise<DagobertPair | null> {
    const pair = await this.store.hget(KVRoot.pairs, symbol);
    return pair === null ? null : (pair as DagobertPair);
  }

  async save(pair: DagobertPair): Promise<void> {
    await this.store.hset(KVRoot.pairs, { [pair.pair]: pair });
  }

  async delete(symbol: string): Promise<void> {
    await this.store.hdel(KVRoot.pairs, symbol);
  }
}
