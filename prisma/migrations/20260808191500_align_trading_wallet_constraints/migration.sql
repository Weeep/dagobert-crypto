-- The original wallet migration was handwritten without Prisma's default
-- ON UPDATE action, and PostgreSQL truncated its overlong unique-index name
-- differently from Prisma. Align the migration history with schema.prisma so
-- `prisma migrate dev` does not generate this repair on every fresh database.

ALTER TABLE "trading_wallets"
  DROP CONSTRAINT "trading_wallets_user_id_fkey";
ALTER TABLE "wallet_reservations"
  DROP CONSTRAINT "wallet_reservations_bot_run_id_fkey";
ALTER TABLE "wallet_reservations"
  DROP CONSTRAINT "wallet_reservations_wallet_id_fkey";

ALTER TABLE "trading_wallets"
  ADD CONSTRAINT "trading_wallets_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wallet_reservations"
  ADD CONSTRAINT "wallet_reservations_wallet_id_fkey"
  FOREIGN KEY ("wallet_id") REFERENCES "trading_wallets"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wallet_reservations"
  ADD CONSTRAINT "wallet_reservations_bot_run_id_fkey"
  FOREIGN KEY ("bot_run_id") REFERENCES "bot_runs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER INDEX "trading_wallets_user_id_exchange_account_environment_quote_asse"
  RENAME TO "trading_wallets_user_id_exchange_account_environment_quote__key";
