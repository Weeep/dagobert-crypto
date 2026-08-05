import type { Prisma, PrismaClient } from "@prisma/client";
import { TradeType } from "@/src/modules/transaction";
import type {
  DagobertTransactionGroup,
  TransactionGroupRepository,
} from "@/src/modules/transaction-group";
import { toDomainTransaction } from "@/src/modules/transaction/infrastructure/prisma/PrismaTransactionRepository";

/** Prisma adapter for transaction-group persistence. */
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

  async save(group: DagobertTransactionGroup): Promise<void> {
    if (!group.groupId) {
      throw new Error("Cannot save transaction group without groupId");
    }

    const transactionIds = group.groupedTrans.map(
      (transaction) => transaction.orderId
    );
    const operations: Array<() => Prisma.PrismaPromise<unknown>> = [
      () =>
        this.prisma.transactionGroup.upsert({
          where: { id: group.groupId! },
          create: toPrismaTransactionGroupCreateInput(group),
          update: toPrismaTransactionGroupUpdateInput(group),
        }),
      () =>
        this.prisma.transaction.updateMany({
          where: { transactionGroupId: group.groupId },
          data: { transactionGroupId: null, grouped: false },
        }),
    ];

    if (transactionIds.length > 0) {
      operations.push(() =>
        this.prisma.transaction.updateMany({
          where: { orderId: { in: transactionIds } },
          data: { transactionGroupId: group.groupId, grouped: true },
        })
      );
    }

    await runGroupWrite(this.prisma, operations);
  }

  async delete(id: string): Promise<void> {
    await runGroupWrite(this.prisma, [
      () =>
        this.prisma.transaction.updateMany({
          where: { transactionGroupId: id },
          data: { transactionGroupId: null, grouped: false },
        }),
      () => this.prisma.transactionGroup.deleteMany({ where: { id } }),
    ]);
  }
}

function toPrismaTransactionGroupCreateInput(
  group: DagobertTransactionGroup
): Prisma.TransactionGroupUncheckedCreateInput {
  if (!group.groupId) {
    throw new Error("Cannot save transaction group without groupId");
  }

  return {
    id: group.groupId,
    pairSymbol: group.pair,
    amount: String(group.amount),
    executed: String(group.executed),
    tradeType: group.tradeType,
    lastTransDateEpoch: group.lastTransDateEpoch,
    note: group.note,
  };
}

function toPrismaTransactionGroupUpdateInput(
  group: DagobertTransactionGroup
): Prisma.TransactionGroupUncheckedUpdateInput {
  return {
    pairSymbol: group.pair,
    amount: String(group.amount),
    executed: String(group.executed),
    tradeType: group.tradeType,
    lastTransDateEpoch: group.lastTransDateEpoch,
    note: group.note,
  };
}

async function runGroupWrite(
  prisma: PrismaClient,
  operations: Array<() => Prisma.PrismaPromise<unknown>>
): Promise<void> {
  if (hasBatchTransaction(prisma)) {
    await prisma.$transaction(operations.map((operation) => operation()));
    return;
  }

  for (const operation of operations) {
    await operation();
  }
}

function hasBatchTransaction(
  prisma: PrismaClient
): prisma is PrismaClient & { $transaction: PrismaClient["$transaction"] } {
  return (
    typeof (prisma as { $transaction?: unknown }).$transaction === "function"
  );
}
