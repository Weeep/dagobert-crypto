import type { DagobertTransaction } from "../../domain/DagobertTransaction";
import type { TradeType } from "../../domain/TradeType";
import type { TransactionRepository } from "../../domain/TransactionRepository";
import {
  fromTransactionDto,
  toTransactionDto,
  type TransactionDto,
} from "../../dto/TransactionDto";
import {
  HttpReadClient,
  HttpReadError,
} from "@/src/shared/infrastructure/http/HttpReadClient";
import { HttpWriteClient } from "@/src/shared/infrastructure/http/HttpWriteClient";

/** Server-backed transaction persistence. */
export class HttpTransactionRepository implements TransactionRepository {
  constructor(
    private readonly http: HttpReadClient,
    private readonly writes: HttpWriteClient
  ) {}

  async findAll(): Promise<DagobertTransaction[]> {
    const transactions = await this.http.get<TransactionDto[]>("/api/transactions");
    return transactions.map(fromTransactionDto);
  }

  async findById(id: string): Promise<DagobertTransaction | null> {
    try {
      const transaction = await this.http.get<TransactionDto>(
        `/api/transactions/${encodeURIComponent(id)}`
      );
      return fromTransactionDto(transaction);
    } catch (error) {
      if (error instanceof HttpReadError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async save(transaction: DagobertTransaction): Promise<void> {
    await this.writes.put(
      `/api/transactions/${encodeURIComponent(transaction.orderId)}`,
      toTransactionDto(transaction)
    );
  }

  async saveMany(transactions: DagobertTransaction[]): Promise<void> {
    await this.writes.put(
      "/api/transactions",
      transactions.map(toTransactionDto)
    );
  }

  getLastProcessedEpoch(pair: string, tradeType: TradeType): Promise<number | null> {
    const query = new URLSearchParams({ pair, tradeType });
    return this.http.get<number | null>(`/api/transactions/last-processed-epoch?${query}`);
  }

  async setLastProcessedEpoch(
    pair: string,
    tradeType: TradeType,
    epoch: number
  ): Promise<void> {
    await this.writes.put("/api/transactions/last-processed-epoch", {
      pair,
      tradeType,
      epoch,
    });
  }
}
