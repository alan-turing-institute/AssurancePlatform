-- Lets a published copy on Discover outlive its source case (Chris's
-- rulings, 2026-09-28): trashing a published case can now archive its
-- Discover copy instead of removing it, and a permanent case delete must
-- succeed even when an archived copy still references it.
--
-- Structure only — no existing row is touched. Ruling 2: "There aren't any
-- published ones [in Trash], so we will be okay" — nothing today holds a
-- published case that is also in Trash, so there is no backfill to write.

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
