export type ReservationResult = { ok: true; reservationId: string; availableBotBudget: string; availableWalletBudget: string }
  | { ok: false; error: string };

export interface BotBudgetRepository {
  reserve(input: { botRunId: string; walletId: string; orderIntentKey: string; amount: string }): Promise<ReservationResult>;
  release(orderIntentKey: string): Promise<boolean>;
  consume(input: { orderIntentKey: string; actualCost: string; fee: string }): Promise<boolean>;
}
