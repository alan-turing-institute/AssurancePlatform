-- Health plugin: the evidence element added under a claim when its settings
-- are accepted.
--
-- Additive only. One nullable column, one unique index and one foreign key. No
-- row is written, so no claim gains an element from this migration. The
-- database clears the column if the element is ever hard-deleted.

-- AlterTable
ALTER TABLE "plugin_health_criteria" ADD COLUMN "evidence_element_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "plugin_health_criteria_evidence_element_id_key" ON "plugin_health_criteria"("evidence_element_id");

-- AddForeignKey
ALTER TABLE "plugin_health_criteria" ADD CONSTRAINT "plugin_health_criteria_evidence_element_id_fkey" FOREIGN KEY ("evidence_element_id") REFERENCES "assurance_elements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
