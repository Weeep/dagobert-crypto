import type { DagobertTransactionGroup } from "../../domain/DagobertTransactionGroup";
import type { TransactionGroupRepository } from "../../domain/TransactionGroupRepository";
import {
  fromTransactionGroupDto,
  type TransactionGroupDto,
} from "../../dto/TransactionGroupDto";
import {
  HttpReadClient,
  HttpReadError,
} from "@/src/shared/infrastructure/http/HttpReadClient";

/**
 * Reads groups from the server API. Writes are temporarily delegated to the
 * client-cache adapter until the write API migration is complete.
 */
export class HttpTransactionGroupRepository implements TransactionGroupRepository {
  constructor(
    private readonly http: HttpReadClient,
    private readonly writeRepository: Pick<TransactionGroupRepository, "save" | "delete">
  ) {}

  async findAll(): Promise<DagobertTransactionGroup[]> {
    const groups = await this.http.get<TransactionGroupDto[]>(
      "/api/transaction-groups"
    );
    return groups.map(fromTransactionGroupDto);
  }

  async findById(id: string): Promise<DagobertTransactionGroup | null> {
    try {
      const group = await this.http.get<TransactionGroupDto>(
        `/api/transaction-groups/${encodeURIComponent(id)}`
      );
      return fromTransactionGroupDto(group);
    } catch (error) {
      if (error instanceof HttpReadError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  save(group: DagobertTransactionGroup): Promise<void> {
    return this.writeRepository.save(group);
  }

  delete(id: string): Promise<void> {
    return this.writeRepository.delete(id);
  }
}
