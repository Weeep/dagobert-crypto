CREATE TYPE "CandleIngestionStatus" AS ENUM ('IDLE', 'HEALTHY', 'ERROR');

CREATE TABLE "candle_ingestion_cursors" (
  "id" UUID NOT NULL,
  "source" TEXT NOT NULL,
  "pair_symbol" TEXT NOT NULL,
  "interval" TEXT NOT NULL,
  "last_closed_open_time" TIMESTAMPTZ(3),
  "last_successful_poll_at" TIMESTAMPTZ(3),
  "clock_offset_ms" BIGINT NOT NULL DEFAULT 0,
  "status" "CandleIngestionStatus" NOT NULL DEFAULT 'IDLE',
  "last_error" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "candle_ingestion_cursors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "candle_ingestion_cursors_source_pair_symbol_interval_key"
  ON "candle_ingestion_cursors"("source", "pair_symbol", "interval");
CREATE INDEX "candle_ingestion_cursors_status_updated_at_idx"
  ON "candle_ingestion_cursors"("status", "updated_at");

ALTER TABLE "candle_ingestion_cursors"
  ADD CONSTRAINT "candle_ingestion_cursors_pair_symbol_fkey"
  FOREIGN KEY ("pair_symbol") REFERENCES "pairs"("symbol")
  ON DELETE CASCADE ON UPDATE CASCADE;
