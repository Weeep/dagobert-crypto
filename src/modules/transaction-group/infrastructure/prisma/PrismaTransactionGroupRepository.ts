import type { PrismaClient } from "@prisma/client";
import { TradeType } from "@/src/modules/transaction";
import type {
  DagobertTransactionGroup,
  TransactionGroupRepository,
} from "@/src/modules/transaction-group";
import { toDomainTransaction } from "@/src/modules/transaction/infrastructure/prisma/PrismaTransactionRepository";

function readOnly(): never {
  throw new Error("The temporary PostgreSQL comparison source is read-only");
}

/** Prisma adapter for group persistence; writes stay disabled during comparison. */
export class PrismaTransactionGroupRepository
  implements TransactionGroupRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  private toDomain(row: any): DagobertTransactionGroup {
    return {
      groupId: row.id,
      pair: row.pairSymbol,
      amount: Number(row.amount),
      executed: Number(row.executed),
      tradeType: row.tradeType as TradeType,
      lastTransDateEpoch: Number(row.lastTransDateEpoch),
      groupedTrans: row.transactions.map(toDomainTransaction),
      note: row.note,
    };
  }

  async findAll(): Promise<DagobertTransactionGroup[]> {
    const rows = await this.prisma.transactionGroup.findMany({
      include: { transactions: true },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findById(id: string): Promise<DagobertTransactionGroup | null> {
    const row = await this.prisma.transactionGroup.findUnique({
      where: { id },
      include: { transactions: true },
    });
    return row ? this.toDomain(row) : null;
  }

  async save(): Promise<void> {
    readOnly();
  }

  async delete(): Promise<void> {
    readOnly();
  }
}
