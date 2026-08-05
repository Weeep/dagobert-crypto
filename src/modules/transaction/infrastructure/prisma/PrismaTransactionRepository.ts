import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  DagobertTransaction,
  TransactionRepository,
} from "@/src/modules/transaction";
import { TradeStyle, TradeType } from "@/src/modules/transaction";

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

/** Prisma adapter for transaction persistence selected by the comparison switch. */
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
          tradeType,
        },
      },
    });
    return cursor ? Number(cursor.lastProcessedEpoch) : null;
  }

  async save(transaction: DagobertTransaction): Promise<void> {
    await this.prisma.transaction.upsert({
      where: { orderId: transaction.orderId },
      create: toPrismaTransactionInput(transaction),
      update: toPrismaTransactionInput(transaction),
    });
  }

  async saveMany(transactions: DagobertTransaction[]): Promise<void> {
    if (transactions.length === 0) return;

    await this.prisma.$transaction(
      transactions.map((transaction) =>
        this.prisma.transaction.upsert({
          where: { orderId: transaction.orderId },
          create: toPrismaTransactionInput(transaction),
          update: toPrismaTransactionInput(transaction),
        })
      )
    );
  }

  async setLastProcessedEpoch(
    pair: string,
    tradeType: TradeType,
    epoch: number
  ): Promise<void> {
    await this.prisma.importCursor.upsert({
      where: {
        pairSymbol_tradeType: {
          pairSymbol: pair,
          tradeType,
        },
      },
      create: {
        pairSymbol: pair,
        tradeType,
        lastProcessedEpoch: epoch,
      },
      update: { lastProcessedEpoch: epoch },
    });
  }
}

function toPrismaTransactionInput(
  transaction: DagobertTransaction
): Prisma.TransactionUncheckedCreateInput {
  return {
    orderId: transaction.orderId,
    binanceApiId: transaction.binanceApiId,
    pairSymbol: transaction.pair,
    amount: String(transaction.amount),
    executed: String(transaction.executed),
    date: transaction.date,
    dateEpoch: transaction.dateEpoch,
    side: transaction.side as Prisma.TransactionUncheckedCreateInput["side"],
    price: String(transaction.price),
    status: transaction.status as Prisma.TransactionUncheckedCreateInput["status"],
    grouped: transaction.grouped,
    note: transaction.note,
    otherSideOrderId: transaction.otherSideOrderId || null,
    tradeType: transaction.tradeType,
    tradeStyle: transaction.tradeStyle,
  };
}
