-- Lets a published copy on Discover outlive its source case: trashing a
-- published case can archive its Discover copy instead of removing it,
-- and permanently deleting a case succeeds even when an archived copy
-- still references it.
--
-- Structure only: no existing row is touched or backfilled.

-- DropForeignKey
ALTER TABLE "published_assurance_cases" DROP CONSTRAINT "published_assurance_cases_assurance_case_id_fkey";

-- AlterTable
ALTER TABLE "published_assurance_cases" ALTER COLUMN "assurance_case_id" DROP NOT NULL;
ALTER TABLE "published_assurance_cases" ADD COLUMN "archived_at" TIMESTAMPTZ(6);
ALTER TABLE "published_assurance_cases" ADD COLUMN "archived_owner_id" TEXT;

-- AddForeignKey
ALTER TABLE "published_assurance_cases" ADD CONSTRAINT "published_assurance_cases_assurance_case_id_fkey" FOREIGN KEY ("assurance_case_id") REFERENCES "assurance_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_assurance_cases" ADD CONSTRAINT "published_assurance_cases_archived_owner_id_fkey" FOREIGN KEY ("archived_owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "published_assurance_cases_archived_owner_id_idx" ON "published_assurance_cases"("archived_owner_id");
