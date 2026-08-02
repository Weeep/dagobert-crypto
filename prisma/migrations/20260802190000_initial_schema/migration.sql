-- CreateEnum
CREATE TYPE "TradeType" AS ENUM ('spot', 'margin');
CREATE TYPE "TradeStyle" AS ENUM ('day', 'swing', 'hodling', 'trash');
CREATE TYPE "OrderSide" AS ENUM ('BUY', 'SELL');
CREATE TYPE "OrderStatus" AS ENUM ('FILLED', 'CANCELED', 'NEW');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pairs" (
    "symbol" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "key_levels" DECIMAL(38,18)[] DEFAULT ARRAY[]::DECIMAL(38,18)[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "pairs_pkey" PRIMARY KEY ("symbol")
);

CREATE TABLE "transaction_groups" (
    "id" UUID NOT NULL,
    "pair_symbol" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "executed" DECIMAL(38,18) NOT NULL,
    "trade_type" "TradeType" NOT NULL,
    "last_trans_date_epoch" BIGINT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "transaction_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "transactions" (
    "order_id" TEXT NOT NULL,
    "binance_api_id" BIGINT NOT NULL,
    "pair_symbol" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "executed" DECIMAL(38,18) NOT NULL,
    "date" TIMESTAMPTZ(3) NOT NULL,
    "date_epoch" BIGINT NOT NULL,
    "side" "OrderSide" NOT NULL,
    "price" DECIMAL(38,18) NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "grouped" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT NOT NULL DEFAULT '',
    "other_side_order_id" TEXT,
    "trade_type" "TradeType" NOT NULL,
    "trade_style" "TradeStyle" NOT NULL,
    "transaction_group_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "transactions_pkey" PRIMARY KEY ("order_id")
);

CREATE TABLE "import_cursors" (
    "pair_symbol" TEXT NOT NULL,
    "trade_type" "TradeType" NOT NULL,
    "last_processed_epoch" BIGINT NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "import_cursors_pkey" PRIMARY KEY ("pair_symbol", "trade_type")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "transaction_groups_pair_symbol_trade_type_last_trans_date_epoch_idx" ON "transaction_groups"("pair_symbol", "trade_type", "last_trans_date_epoch" DESC);
CREATE INDEX "transactions_pair_symbol_date_idx" ON "transactions"("pair_symbol", "date" DESC);
CREATE INDEX "transactions_trade_type_status_date_idx" ON "transactions"("trade_type", "status", "date" DESC);
CREATE INDEX "transactions_transaction_group_id_idx" ON "transactions"("transaction_group_id");
CREATE INDEX "import_cursors_last_processed_epoch_idx" ON "import_cursors"("last_processed_epoch");

-- AddForeignKey
ALTER TABLE "transaction_groups" ADD CONSTRAINT "transaction_groups_pair_symbol_fkey" FOREIGN KEY ("pair_symbol") REFERENCES "pairs"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_pair_symbol_fkey" FOREIGN KEY ("pair_symbol") REFERENCES "pairs"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_transaction_group_id_fkey" FOREIGN KEY ("transaction_group_id") REFERENCES "transaction_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "import_cursors" ADD CONSTRAINT "import_cursors_pair_symbol_fkey" FOREIGN KEY ("pair_symbol") REFERENCES "pairs"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;
