import type { DagobertPair } from "./DagobertPair";

export interface PairRepository {
  findAll(): Promise<DagobertPair[]>;
  findBySymbol(symbol: string): Promise<DagobertPair | null>;
  save(pair: DagobertPair): Promise<void>;
  delete(symbol: string): Promise<void>;
}
