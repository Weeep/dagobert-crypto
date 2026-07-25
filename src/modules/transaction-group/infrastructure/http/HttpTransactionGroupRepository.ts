import type { DagobertTransactionGroup } from "../../domain/DagobertTransactionGroup";
import type { TransactionGroupRepository } from "../../domain/TransactionGroupRepository";
import {
  fromTransactionGroupDto,
  toTransactionGroupDto,
  type TransactionGroupDto,
} from "../../dto/TransactionGroupDto";
import {
  HttpReadClient,
  HttpReadError,
} from "@/src/shared/infrastructure/http/HttpReadClient";
import { HttpWriteClient } from "@/src/shared/infrastructure/http/HttpWriteClient";

/**
 * Reads and writes groups through the authenticated server API.
 */
export class HttpTransactionGroupRepository implements TransactionGroupRepository {
  constructor(
    private readonly http: HttpReadClient,
    private readonly writes: HttpWriteClient
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

  async save(group: DagobertTransactionGroup): Promise<void> {
    if (!group.groupId) throw new Error("Cannot save transaction group without groupId");
    await this.writes.put(
      `/api/transaction-groups/${encodeURIComponent(group.groupId)}`,
      toTransactionGroupDto(group)
    );
  }

  async delete(id: string): Promise<void> {
    await this.writes.delete(`/api/transaction-groups/${encodeURIComponent(id)}`);
  }
}
