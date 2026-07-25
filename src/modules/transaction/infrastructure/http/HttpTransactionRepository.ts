import type { DagobertTransaction } from "../../domain/DagobertTransaction";
import type { TradeType } from "../../domain/TradeType";
import type { TransactionRepository } from "../../domain/TransactionRepository";
import {
  fromTransactionDto,
  type TransactionDto,
} from "../../dto/TransactionDto";
import {
  HttpReadClient,
  HttpReadError,
} from "@/src/shared/infrastructure/http/HttpReadClient";

type TransactionWriteRepository = Pick<
  TransactionRepository,
  "save" | "saveMany" | "getLastProcessedEpoch" | "setLastProcessedEpoch"
>;

/** Server-backed entity reads with temporary client-cache write/epoch delegation. */
export class HttpTransactionRepository implements TransactionRepository {
  constructor(
    private readonly http: HttpReadClient,
    private readonly writeRepository: TransactionWriteRepository
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

  save(transaction: DagobertTransaction): Promise<void> {
    return this.writeRepository.save(transaction);
  }

  saveMany(transactions: DagobertTransaction[]): Promise<void> {
    return this.writeRepository.saveMany(transactions);
  }

  getLastProcessedEpoch(pair: string, tradeType: TradeType): Promise<number | null> {
    return this.writeRepository.getLastProcessedEpoch(pair, tradeType);
  }

  setLastProcessedEpoch(
    pair: string,
    tradeType: TradeType,
    epoch: number
  ): Promise<void> {
    return this.writeRepository.setLastProcessedEpoch(pair, tradeType, epoch);
  }
}
