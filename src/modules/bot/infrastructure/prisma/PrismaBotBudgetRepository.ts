import Big from "big.js";
import { Prisma, type PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { BotBudgetRepository, ReservationResult } from "../../domain/BotBudgetRepository";

/** Serializes each wallet while atomically checking both the run ledger and shared wallet. */
export class PrismaBotBudgetRepository implements BotBudgetRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async reserve(input: { botRunId: string; walletId: string; orderIntentKey: string; amount: string }): Promise<ReservationResult> {
    let amount: Big;
    try { amount = new Big(input.amount); if (amount.lte(0)) throw new Error(); }
    catch { return { ok: false, error: "Reservation amount must be positive" }; }
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.walletReservation.findUnique({ where: { orderIntentKey: input.orderIntentKey } });
      if (existing && (existing.botRunId !== input.botRunId || existing.walletId !== input.walletId || !new Big(existing.amount.toString()).eq(amount)))
        return { ok: false, error: "Reservation key belongs to a different request" };
      if (existing && existing.status !== "PENDING") return { ok: false, error: "Reservation key has already been resolved" };
      await tx.$queryRaw`SELECT id FROM trading_wallets WHERE id = ${input.walletId}::uuid FOR UPDATE`;
      const run = await tx.botRun.findUnique({ where: { id: input.botRunId }, include: { bot: true } });
      const wallet = await tx.tradingWallet.findUnique({ where: { id: input.walletId } });
      if (!run || !wallet || wallet.userId !== run.bot.userId) return { ok: false, error: "Run or owner wallet not found" };
      if (run.status !== "RUNNING" || wallet.reconciliationStatus !== "CURRENT") return { ok: false, error: "Run or wallet is not available for reservations" };
      const ledger = await tx.botLedgerEntry.aggregate({ where: { botRunId: run.id }, _sum: { amount: true } });
      const botPending = await tx.walletReservation.aggregate({ where: { botRunId: run.id, status: "PENDING" }, _sum: { amount: true } });
      const walletPending = await tx.walletReservation.aggregate({ where: { walletId: wallet.id, status: "PENDING" }, _sum: { amount: true } });
      const botCash = new Big(ledger._sum.amount?.toString() ?? run.bot.assignedBudget.toString());
      const availableBot = botCash.minus(botPending._sum.amount?.toString() ?? "0");
      const availableWallet = new Big(wallet.lastReconciledFree.toString()).minus(walletPending._sum.amount?.toString() ?? "0");
      if (existing) return { ok: true, reservationId: existing.id, availableBotBudget: availableBot.toString(), availableWalletBudget: availableWallet.toString() };
      if (amount.gt(availableBot) || amount.gt(availableWallet)) return { ok: false, error: "Insufficient bot or owner-wallet budget" };
      const reservation = await tx.walletReservation.create({ data: { id: randomUUID(), ...input, amount: amount.toString() } });
      return { ok: true, reservationId: reservation.id, availableBotBudget: availableBot.minus(amount).toString(), availableWalletBudget: availableWallet.minus(amount).toString() };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  async release(orderIntentKey: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.walletReservation.findUnique({ where: { orderIntentKey } });
      if (!reservation) return false;
      if (reservation.status === "RELEASED") return true;
      if (reservation.status !== "PENDING") return false;
      await tx.$queryRaw`SELECT id FROM trading_wallets WHERE id = ${reservation.walletId}::uuid FOR UPDATE`;
      await tx.walletReservation.update({ where: { id: reservation.id }, data: { status: "RELEASED", resolvedAt: new Date() } });
      return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
