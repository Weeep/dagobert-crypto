import type { PrismaClient } from "@prisma/client";
import type { PairRepository, DagobertPair } from "@/src/modules/pair";
import type {
  DagobertTransaction,
  TransactionRepository,
} from "@/src/modules/transaction";
import { TradeStyle, TradeType } from "@/src/modules/transaction";
import type {
  DagobertTransactionGroup,
  TransactionGroupRepository,
} from "@/src/modules/transaction-group";

function readOnly(): never {
  throw new Error("The temporary PostgreSQL comparison source is read-only");
}

function toTransaction(row: any): DagobertTransaction {
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

export class PrismaPairRepository implements PairRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(): Promise<DagobertPair[]> {
    const rows = await this.prisma.pair.findMany();
    return rows.map((row) => ({
      pair: row.symbol,
      decimals: row.decimals,
      keyLevels: row.keyLevels.map(Number),
    }));
  }

  async findBySymbol(symbol: string): Promise<DagobertPair | null> {
    const row = await this.prisma.pair.findUnique({ where: { symbol } });
    return row
      ? { pair: row.symbol, decimals: row.decimals, keyLevels: row.keyLevels.map(Number) }
      : null;
  }

  async save(): Promise<void> { readOnly(); }
  async delete(): Promise<void> { readOnly(); }
}

export class PrismaTransactionRepository implements TransactionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(): Promise<DagobertTransaction[]> {
    return (await this.prisma.transaction.findMany()).map(toTransaction);
  }

  async findById(id: string): Promise<DagobertTransaction | null> {
    const row = await this.prisma.transaction.findUnique({ where: { orderId: id } });
    return row ? toTransaction(row) : null;
  }

  async getLastProcessedEpoch(pair: string, tradeType: TradeType): Promise<number | null> {
    const cursor = await this.prisma.importCursor.findUnique({
      where: { pairSymbol_tradeType: { pairSymbol: pair, tradeType: tradeType as any } },
    });
    return cursor ? Number(cursor.lastProcessedEpoch) : null;
  }

  async save(): Promise<void> { readOnly(); }
  async saveMany(): Promise<void> { readOnly(); }
  async setLastProcessedEpoch(): Promise<void> { readOnly(); }
}

export class PrismaTransactionGroupRepository
  implements TransactionGroupRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  private toGroup(row: any): DagobertTransactionGroup {
    return {
      groupId: row.id,
      pair: row.pairSymbol,
      amount: Number(row.amount),
      executed: Number(row.executed),
      tradeType: row.tradeType as TradeType,
      lastTransDateEpoch: Number(row.lastTransDateEpoch),
      groupedTrans: row.transactions.map(toTransaction),
      note: row.note,
    };
  }

  async findAll(): Promise<DagobertTransactionGroup[]> {
    const rows = await this.prisma.transactionGroup.findMany({
      include: { transactions: true },
    });
    return rows.map((row) => this.toGroup(row));
  }

  async findById(id: string): Promise<DagobertTransactionGroup | null> {
    const row = await this.prisma.transactionGroup.findUnique({
      where: { id },
      include: { transactions: true },
    });
    return row ? this.toGroup(row) : null;
  }

  async save(): Promise<void> { readOnly(); }
  async delete(): Promise<void> { readOnly(); }
}

export function createPrismaReadRepositories(prisma: PrismaClient) {
  return {
    pairRepository: new PrismaPairRepository(prisma),
    transactionRepository: new PrismaTransactionRepository(prisma),
    transactionGroupRepository: new PrismaTransactionGroupRepository(prisma),
  };
}
