import type { PrismaClient } from "@prisma/client";
import type {
  DagobertTransaction,
  TransactionRepository,
} from "@/src/modules/transaction";
import { TradeStyle, TradeType } from "@/src/modules/transaction";

function readOnly(): never {
  throw new Error("The temporary PostgreSQL comparison source is read-only");
}

export function toDomainTransaction(row: any): DagobertTransaction {
  return {
    orderId: row.orderId,
    binanceApiId: Number(row.binanceApiId),
    pair: row.pairSymbol,
    amount: Number(row.amount),
    executed: Number(row.executed),
    date: row.date,
    dateEpoch: Number(row.dateEpoch),
    side: row.side,
    price: Number(row.price),
    status: row.status,
    grouped: row.grouped,
    note: row.note,
    otherSideOrderId: row.otherSideOrderId ?? "",
    tradeType: row.tradeType as TradeType,
    tradeStyle: row.tradeStyle as TradeStyle,
  };
}

/** Prisma adapter for transaction persistence; writes stay disabled during comparison. */
export class PrismaTransactionRepository implements TransactionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(): Promise<DagobertTransaction[]> {
    return (await this.prisma.transaction.findMany()).map(toDomainTransaction);
  }

  async findById(id: string): Promise<DagobertTransaction | null> {
    const row = await this.prisma.transaction.findUnique({
      where: { orderId: id },
    });
    return row ? toDomainTransaction(row) : null;
  }

  async getLastProcessedEpoch(
    pair: string,
    tradeType: TradeType
  ): Promise<number | null> {
    const cursor = await this.prisma.importCursor.findUnique({
      where: {
        pairSymbol_tradeType: {
          pairSymbol: pair,
          tradeType: tradeType as any,
        },
      },
    });
    return cursor ? Number(cursor.lastProcessedEpoch) : null;
  }

  async save(): Promise<void> {
    readOnly();
  }

  async saveMany(): Promise<void> {
    readOnly();
  }

  async setLastProcessedEpoch(): Promise<void> {
    readOnly();
  }
}
