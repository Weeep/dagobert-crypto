ALTER TABLE "bots" ADD COLUMN "archived_at" TIMESTAMPTZ(3);
CREATE INDEX "bots_user_id_archived_at_idx" ON "bots"("user_id", "archived_at");
