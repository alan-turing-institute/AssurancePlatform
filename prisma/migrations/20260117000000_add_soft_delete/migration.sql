-- Soft delete fields for recycle bin feature
ALTER TABLE "assurance_cases" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "assurance_cases" ADD COLUMN "deleted_by_id" TEXT;

-- Indexes for efficient trash queries
CREATE INDEX "assurance_cases_deleted_at_idx" ON "assurance_cases"("deleted_at");
CREATE INDEX "assurance_cases_owner_deleted_idx" ON "assurance_cases"("created_by_id", "deleted_at");
