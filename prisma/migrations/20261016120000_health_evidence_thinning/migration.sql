-- Health plugin: notes for the stretches of repeated passing results the
-- nightly thinning job removes from a claim's evidence log.
--
-- Additive only. One nullable column on the per-claim state row (where the
-- job last stopped for that claim) and one new table. No row is written, so
-- no existing record is touched by this migration.

-- AlterTable
ALTER TABLE "plugin_health_claim_states" ADD COLUMN     "thinned_through_sequence" INTEGER;

-- CreateTable
CREATE TABLE "plugin_health_thinned_runs" (
    "id" TEXT NOT NULL,
    "claim_id" TEXT NOT NULL,
    "kept_before_id" TEXT NOT NULL,
    "kept_after_id" TEXT NOT NULL,
    "removed_count" INTEGER NOT NULL,
    "first_removed_sequence" INTEGER NOT NULL,
    "last_removed_sequence" INTEGER NOT NULL,
    "first_removed_at" TIMESTAMP(3) NOT NULL,
    "last_removed_at" TIMESTAMP(3) NOT NULL,
    "rule_version" INTEGER NOT NULL,
    "thinned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plugin_health_thinned_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plugin_health_thinned_runs_kept_before_id_key" ON "plugin_health_thinned_runs"("kept_before_id");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_health_thinned_runs_kept_after_id_key" ON "plugin_health_thinned_runs"("kept_after_id");

-- CreateIndex
CREATE INDEX "plugin_health_thinned_runs_claim_id_idx" ON "plugin_health_thinned_runs"("claim_id");

-- AddForeignKey
ALTER TABLE "plugin_health_thinned_runs" ADD CONSTRAINT "plugin_health_thinned_runs_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "assurance_elements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_health_thinned_runs" ADD CONSTRAINT "plugin_health_thinned_runs_kept_before_id_fkey" FOREIGN KEY ("kept_before_id") REFERENCES "plugin_health_evidence"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_health_thinned_runs" ADD CONSTRAINT "plugin_health_thinned_runs_kept_after_id_fkey" FOREIGN KEY ("kept_after_id") REFERENCES "plugin_health_evidence"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
