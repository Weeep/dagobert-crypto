import type { PairRepository } from "../../domain/PairRepository";
import type { DagobertPair } from "../../domain/DagobertPair";
import { fromPairDto, type PairDto } from "../../dto/PairDto";
import {
  HttpReadClient,
  HttpReadError,
} from "@/src/shared/infrastructure/http/HttpReadClient";

/**
 * Reads pairs from the server API. Writes are temporarily delegated to the
 * client-cache adapter until the write API migration is complete.
 */
export class HttpPairRepository implements PairRepository {
  constructor(
    private readonly http: HttpReadClient,
    private readonly writeRepository: Pick<PairRepository, "save" | "delete">
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

  save(pair: DagobertPair): Promise<void> {
    return this.writeRepository.save(pair);
  }

  delete(symbol: string): Promise<void> {
    return this.writeRepository.delete(symbol);
  }
}
