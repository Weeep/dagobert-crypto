import type { PairRepository } from "../../domain/PairRepository";
import type { DagobertPair } from "../../domain/DagobertPair";
import { fromPairDto, type PairDto } from "../../dto/PairDto";
import {
  HttpReadClient,
  HttpReadError,
} from "@/src/shared/infrastructure/http/HttpReadClient";
import { HttpWriteClient } from "@/src/shared/infrastructure/http/HttpWriteClient";
import { toPairDto } from "../../dto/PairDto";

/**
 * Reads and writes pairs through the authenticated server API.
 */
export class HttpPairRepository implements PairRepository {
  constructor(
    private readonly http: HttpReadClient,
    private readonly writes: HttpWriteClient
  ) {}

  async findAll(): Promise<DagobertPair[]> {
    const pairs = await this.http.get<PairDto[]>("/api/pairs");
    return pairs.map(fromPairDto);
  }

  async findBySymbol(symbol: string): Promise<DagobertPair | null> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    try {
      const pair = await this.http.get<PairDto>(
        `/api/pairs/${encodeURIComponent(normalizedSymbol)}`
      );
      return fromPairDto(pair);
    } catch (error) {
      if (error instanceof HttpReadError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async save(pair: DagobertPair): Promise<void> {
    await this.writes.put(`/api/pairs/${encodeURIComponent(pair.pair)}`, toPairDto(pair));
  }

  async delete(symbol: string): Promise<void> {
    await this.writes.delete(`/api/pairs/${encodeURIComponent(symbol.trim().toUpperCase())}`);
  }
}
