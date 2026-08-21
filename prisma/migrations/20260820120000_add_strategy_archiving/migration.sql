ALTER TABLE "strategies" ADD COLUMN "archived_at" TIMESTAMPTZ(3);
CREATE INDEX "strategies_user_id_archived_at_idx" ON "strategies"("user_id", "archived_at");
