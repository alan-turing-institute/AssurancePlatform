-- ADR 0004 D5: element-level citation. Additive only — nullable self-relation
-- column + a default-false flag column, no backfill, no behaviour change for
-- existing rows. Applicability (AWAY_GOAL only) is enforced in application
-- code, not by the schema. ON DELETE SET NULL is a defence-in-depth safety
-- net for the rare hard-delete path (case purge) — it mirrors the existing
-- defeats_element_id FK below and does NOT replace the primary integrity
-- rule, which is enforced explicitly in element-service.ts (nullify +
-- citation_dangling flag) on the normal soft-delete/detach paths, since a
-- bare DB-level action cannot also set the flag.

-- AlterTable
ALTER TABLE "assurance_elements" ADD COLUMN "cited_element_id" TEXT;
ALTER TABLE "assurance_elements" ADD COLUMN "citation_dangling" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "assurance_elements_citedElementId_idx" ON "assurance_elements"("cited_element_id");

-- AddForeignKey
ALTER TABLE "assurance_elements" ADD CONSTRAINT "assurance_elements_cited_element_id_fkey" FOREIGN KEY ("cited_element_id") REFERENCES "assurance_elements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
