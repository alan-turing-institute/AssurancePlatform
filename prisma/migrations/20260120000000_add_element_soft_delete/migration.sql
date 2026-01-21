-- Add soft delete fields to AssuranceElement
ALTER TABLE "assurance_elements" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "assurance_elements" ADD COLUMN "deleted_by_id" TEXT;

-- Add foreign key constraint
ALTER TABLE "assurance_elements" ADD CONSTRAINT "assurance_elements_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for efficient soft delete queries (find active elements for a case)
CREATE INDEX "assurance_elements_case_deleted_idx" ON "assurance_elements"("case_id", "deleted_at");
