import ClientSideDbCache from "@/app/lib/ClientSideDbCache";
import type { DagobertPair } from "../../domain/DagobertPair";
import type { PairRepository } from "../../domain/PairRepository";
import { KVRoot } from "@/src/shared/infrastructure/kv/KVRoot";

export class KvPairRepository implements PairRepository {
  findAll(): Promise<DagobertPair[]> {
    return Promise.resolve(
      Object.values(ClientSideDbCache.hgetall(KVRoot.pairs) ?? {}) as DagobertPair[]
    );
  }

  findBySymbol(symbol: string): Promise<DagobertPair | null> {
    return Promise.resolve(ClientSideDbCache.hget(KVRoot.pairs, symbol) as DagobertPair | null);
  }

  async save(pair: DagobertPair): Promise<void> {
    await ClientSideDbCache.hset(KVRoot.pairs, { [pair.pair]: pair });
  }

  async delete(symbol: string): Promise<void> {
    await ClientSideDbCache.hdel(KVRoot.pairs, symbol);
  }
}
