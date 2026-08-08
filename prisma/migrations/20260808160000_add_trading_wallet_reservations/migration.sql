CREATE TYPE "WalletReconciliationStatus" AS ENUM ('CURRENT', 'STALE', 'MISMATCH');
CREATE TYPE "WalletReservationStatus" AS ENUM ('PENDING', 'CONSUMED', 'RELEASED');
CREATE TABLE "trading_wallets" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL, "exchange" TEXT NOT NULL, "account" TEXT NOT NULL,
  "environment" TEXT NOT NULL, "quote_asset" TEXT NOT NULL, "last_reconciled_free" DECIMAL(38,18) NOT NULL,
  "reconciled_at" TIMESTAMPTZ(3), "reconciliation_status" "WalletReconciliationStatus" NOT NULL DEFAULT 'STALE',
  "version" INTEGER NOT NULL DEFAULT 0, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL, CONSTRAINT "trading_wallets_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "wallet_reservations" (
  "id" UUID NOT NULL, "wallet_id" UUID NOT NULL, "bot_run_id" UUID NOT NULL, "order_intent_key" TEXT NOT NULL,
  "amount" DECIMAL(38,18) NOT NULL, "status" "WalletReservationStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "resolved_at" TIMESTAMPTZ(3),
  CONSTRAINT "wallet_reservations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "trading_wallets_user_id_exchange_account_environment_quote__key" ON "trading_wallets"("user_id", "exchange", "account", "environment", "quote_asset");
CREATE UNIQUE INDEX "wallet_reservations_order_intent_key_key" ON "wallet_reservations"("order_intent_key");
CREATE INDEX "wallet_reservations_wallet_id_status_idx" ON "wallet_reservations"("wallet_id", "status");
CREATE INDEX "wallet_reservations_bot_run_id_status_idx" ON "wallet_reservations"("bot_run_id", "status");
ALTER TABLE "trading_wallets" ADD CONSTRAINT "trading_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wallet_reservations" ADD CONSTRAINT "wallet_reservations_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "trading_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wallet_reservations" ADD CONSTRAINT "wallet_reservations_bot_run_id_fkey" FOREIGN KEY ("bot_run_id") REFERENCES "bot_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
