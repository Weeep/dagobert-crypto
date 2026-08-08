-- CreateEnum
CREATE TYPE "BotMode" AS ENUM ('BACKTEST', 'PAPER', 'SPOT_TEST', 'SPOT_LIVE');

-- CreateEnum
CREATE TYPE "BotStatus" AS ENUM ('DRAFT', 'RUNNING', 'PAUSED', 'STOPPED', 'ERROR');

-- CreateEnum
CREATE TYPE "BotRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'STOPPED', 'ERROR');

-- CreateEnum
CREATE TYPE "BotAction" AS ENUM ('BUY', 'SELL', 'HOLD');

-- CreateEnum
CREATE TYPE "BotOrderStatus" AS ENUM ('PENDING', 'SUBMITTED', 'PARTIALLY_FILLED', 'FILLED', 'CANCELED', 'REJECTED', 'RECONCILIATION_REQUIRED');

-- CreateEnum
CREATE TYPE "PositionStatus" AS ENUM ('OPENING', 'OPEN', 'CLOSING', 'CLOSED', 'ERROR');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('ALLOCATION', 'RESERVE', 'RELEASE', 'BUY_COST', 'SELL_PROCEEDS', 'FEE', 'CORRECTION');

-- CreateTable
CREATE TABLE "bots" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "pair_symbol" TEXT NOT NULL,
    "assigned_budget" DECIMAL(38,18) NOT NULL,
    "amount_per_position" DECIMAL(38,18) NOT NULL,
    "timeframe" TEXT NOT NULL,
    "mode" "BotMode" NOT NULL DEFAULT 'BACKTEST',
    "status" "BotStatus" NOT NULL DEFAULT 'DRAFT',
    "strategy_version_id" UUID NOT NULL,
    "fee_rate" DECIMAL(20,12) NOT NULL DEFAULT 0,
    "slippage_rate" DECIMAL(20,12) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategies" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "strategies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategy_versions" (
    "id" UUID NOT NULL,
    "strategy_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "definition" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "strategy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candles" (
    "id" UUID NOT NULL,
    "pair_symbol" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "open_time" TIMESTAMPTZ(3) NOT NULL,
    "close_time" TIMESTAMPTZ(3) NOT NULL,
    "open" DECIMAL(38,18) NOT NULL,
    "high" DECIMAL(38,18) NOT NULL,
    "low" DECIMAL(38,18) NOT NULL,
    "close" DECIMAL(38,18) NOT NULL,
    "volume" DECIMAL(38,18) NOT NULL,
    "quote_volume" DECIMAL(38,18) NOT NULL,
    "trades" INTEGER NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'BINANCE',
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_runs" (
    "id" UUID NOT NULL,
    "bot_id" UUID NOT NULL,
    "mode" "BotMode" NOT NULL,
    "status" "BotRunStatus" NOT NULL DEFAULT 'RUNNING',
    "configuration_snapshot" JSONB NOT NULL,
    "strategy_snapshot" JSONB NOT NULL,
    "backtest_from" TIMESTAMPTZ(3),
    "backtest_to" TIMESTAMPTZ(3),
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(3),
    "error_message" TEXT,

    CONSTRAINT "bot_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" UUID NOT NULL,
    "bot_run_id" UUID NOT NULL,
    "status" "PositionStatus" NOT NULL DEFAULT 'OPENING',
    "entry_cost" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "entry_quantity" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "remaining_quantity" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "average_entry_price" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "average_exit_price" DECIMAL(38,18),
    "fees" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "realized_pnl" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "opened_at" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_orders" (
    "id" UUID NOT NULL,
    "bot_run_id" UUID NOT NULL,
    "position_id" UUID,
    "idempotency_key" TEXT NOT NULL,
    "exchange_order_id" TEXT,
    "side" "OrderSide" NOT NULL,
    "status" "BotOrderStatus" NOT NULL DEFAULT 'PENDING',
    "requested_quote_amount" DECIMAL(38,18),
    "requested_quantity" DECIMAL(38,18),
    "executed_quantity" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bot_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fills" (
    "id" UUID NOT NULL,
    "bot_order_id" UUID NOT NULL,
    "exchange_trade_id" TEXT,
    "quantity" DECIMAL(38,18) NOT NULL,
    "price" DECIMAL(38,18) NOT NULL,
    "commission" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "commission_asset" TEXT,
    "filled_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_ledger_entries" (
    "id" UUID NOT NULL,
    "bot_run_id" UUID NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "balance_after" DECIMAL(38,18) NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategy_decisions" (
    "id" UUID NOT NULL,
    "bot_run_id" UUID NOT NULL,
    "candle_id" UUID NOT NULL,
    "action" "BotAction" NOT NULL,
    "reason_code" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "evaluated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "strategy_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indicator_snapshots" (
    "id" UUID NOT NULL,
    "bot_run_id" UUID NOT NULL,
    "candle_id" UUID NOT NULL,
    "values" JSONB NOT NULL,
    "calculated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indicator_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_events" (
    "id" UUID NOT NULL,
    "bot_run_id" UUID NOT NULL,
    "sequence_number" BIGINT NOT NULL,
    "event_type" TEXT NOT NULL,
    "candle_open_time" TIMESTAMPTZ(3),
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_snapshots" (
    "id" UUID NOT NULL,
    "bot_run_id" UUID NOT NULL,
    "sequence_number" BIGINT NOT NULL,
    "available_budget" DECIMAL(38,18) NOT NULL,
    "reserved_budget" DECIMAL(38,18) NOT NULL,
    "invested_cost" DECIMAL(38,18) NOT NULL,
    "market_value" DECIMAL(38,18) NOT NULL,
    "realized_pnl" DECIMAL(38,18) NOT NULL,
    "unrealized_pnl" DECIMAL(38,18) NOT NULL,
    "total_equity" DECIMAL(38,18) NOT NULL,
    "captured_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bots_status_mode_idx" ON "bots"("status", "mode");

-- CreateIndex
CREATE INDEX "bots_pair_symbol_timeframe_idx" ON "bots"("pair_symbol", "timeframe");

-- CreateIndex
CREATE UNIQUE INDEX "bots_user_id_name_key" ON "bots"("user_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "strategies_user_id_name_key" ON "strategies"("user_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "strategy_versions_strategy_id_version_key" ON "strategy_versions"("strategy_id", "version");

-- CreateIndex
CREATE INDEX "candles_pair_symbol_interval_close_time_idx" ON "candles"("pair_symbol", "interval", "close_time" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "candles_pair_symbol_interval_open_time_key" ON "candles"("pair_symbol", "interval", "open_time");

-- CreateIndex
CREATE INDEX "bot_runs_bot_id_started_at_idx" ON "bot_runs"("bot_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "bot_runs_status_idx" ON "bot_runs"("status");

-- CreateIndex
CREATE INDEX "positions_bot_run_id_status_idx" ON "positions"("bot_run_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bot_orders_idempotency_key_key" ON "bot_orders"("idempotency_key");

-- CreateIndex
CREATE INDEX "bot_orders_bot_run_id_status_idx" ON "bot_orders"("bot_run_id", "status");

-- CreateIndex
CREATE INDEX "bot_orders_exchange_order_id_idx" ON "bot_orders"("exchange_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "fills_bot_order_id_exchange_trade_id_key" ON "fills"("bot_order_id", "exchange_trade_id");

-- CreateIndex
CREATE INDEX "bot_ledger_entries_bot_run_id_occurred_at_idx" ON "bot_ledger_entries"("bot_run_id", "occurred_at");

-- CreateIndex
CREATE INDEX "strategy_decisions_bot_run_id_evaluated_at_idx" ON "strategy_decisions"("bot_run_id", "evaluated_at");

-- CreateIndex
CREATE UNIQUE INDEX "strategy_decisions_bot_run_id_candle_id_key" ON "strategy_decisions"("bot_run_id", "candle_id");

-- CreateIndex
CREATE UNIQUE INDEX "indicator_snapshots_bot_run_id_candle_id_key" ON "indicator_snapshots"("bot_run_id", "candle_id");

-- CreateIndex
CREATE INDEX "bot_events_bot_run_id_occurred_at_idx" ON "bot_events"("bot_run_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "bot_events_bot_run_id_sequence_number_key" ON "bot_events"("bot_run_id", "sequence_number");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_snapshots_bot_run_id_sequence_number_key" ON "portfolio_snapshots"("bot_run_id", "sequence_number");

-- AddForeignKey
ALTER TABLE "bots" ADD CONSTRAINT "bots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bots" ADD CONSTRAINT "bots_pair_symbol_fkey" FOREIGN KEY ("pair_symbol") REFERENCES "pairs"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bots" ADD CONSTRAINT "bots_strategy_version_id_fkey" FOREIGN KEY ("strategy_version_id") REFERENCES "strategy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_versions" ADD CONSTRAINT "strategy_versions_strategy_id_fkey" FOREIGN KEY ("strategy_id") REFERENCES "strategies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candles" ADD CONSTRAINT "candles_pair_symbol_fkey" FOREIGN KEY ("pair_symbol") REFERENCES "pairs"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_runs" ADD CONSTRAINT "bot_runs_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_bot_run_id_fkey" FOREIGN KEY ("bot_run_id") REFERENCES "bot_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_orders" ADD CONSTRAINT "bot_orders_bot_run_id_fkey" FOREIGN KEY ("bot_run_id") REFERENCES "bot_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_orders" ADD CONSTRAINT "bot_orders_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fills" ADD CONSTRAINT "fills_bot_order_id_fkey" FOREIGN KEY ("bot_order_id") REFERENCES "bot_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_ledger_entries" ADD CONSTRAINT "bot_ledger_entries_bot_run_id_fkey" FOREIGN KEY ("bot_run_id") REFERENCES "bot_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_decisions" ADD CONSTRAINT "strategy_decisions_bot_run_id_fkey" FOREIGN KEY ("bot_run_id") REFERENCES "bot_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_decisions" ADD CONSTRAINT "strategy_decisions_candle_id_fkey" FOREIGN KEY ("candle_id") REFERENCES "candles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicator_snapshots" ADD CONSTRAINT "indicator_snapshots_bot_run_id_fkey" FOREIGN KEY ("bot_run_id") REFERENCES "bot_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicator_snapshots" ADD CONSTRAINT "indicator_snapshots_candle_id_fkey" FOREIGN KEY ("candle_id") REFERENCES "candles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_events" ADD CONSTRAINT "bot_events_bot_run_id_fkey" FOREIGN KEY ("bot_run_id") REFERENCES "bot_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_bot_run_id_fkey" FOREIGN KEY ("bot_run_id") REFERENCES "bot_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

