-- Health plugin: evidence settings for each claim, the check lists pipelines
-- publish, and the comparison each result carries with the accepted settings.
--
-- Additive only. Every result stored before this migration is marked
-- UNDECLARED: no settings existed for it to be compared with.

-- CreateEnum
CREATE TYPE "PluginHealthEchoState" AS ENUM ('MATCH', 'MISMATCH', 'UNDECLARED');

-- CreateEnum
CREATE TYPE "PluginHealthCriteriaState" AS ENUM ('SUGGESTED', 'ACCEPTED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PluginHealthCriteriaAction" AS ENUM ('SUGGESTED', 'ACCEPTED', 'EDITED', 'RETIRED', 'DISCARDED');

-- AlterEnum
-- The new value is not used by any statement in this migration: Postgres does
-- not allow a value added in a transaction to be used in the same one.
ALTER TYPE "PluginHealthBindingSource" ADD VALUE 'DECLARATION';

-- AlterTable
-- The default marks every stored record, then is dropped so that code which
-- forgets to set the column does not compile.
ALTER TABLE "plugin_health_evidence"
    ADD COLUMN "echo_state" "PluginHealthEchoState" NOT NULL DEFAULT 'UNDECLARED',
    ADD COLUMN "echo_differences" JSONB,
    ADD COLUMN "criteria_revision" INTEGER;

ALTER TABLE "plugin_health_evidence" ALTER COLUMN "echo_state" DROP DEFAULT;

-- CreateTable
CREATE TABLE "plugin_health_criteria" (
    "claim_id" TEXT NOT NULL,
    "integration_id" TEXT,
    "state" "PluginHealthCriteriaState" NOT NULL,
    "check_name" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "rule_version" INTEGER NOT NULL,
    "reduction_version" INTEGER NOT NULL,
    "aggregation_version" INTEGER NOT NULL,
    "source" JSONB NOT NULL,
    "check_description" JSONB NOT NULL,
    "revision" INTEGER NOT NULL,
    "accepted_by_id" TEXT,
    "accepted_at" TIMESTAMP(3),
    "accepted_by_owns_integration" BOOLEAN NOT NULL DEFAULT false,
    "updated_by_id" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_read_at" TIMESTAMP(3),
    "last_read_revision" INTEGER,

    CONSTRAINT "plugin_health_criteria_pkey" PRIMARY KEY ("claim_id")
);

-- CreateTable
CREATE TABLE "plugin_health_criteria_revisions" (
    "id" TEXT NOT NULL,
    "claim_id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "action" "PluginHealthCriteriaAction" NOT NULL,
    "declaration" JSONB NOT NULL,
    "reason" TEXT,
    "integration_name" TEXT,
    "pipeline_name" TEXT,
    "actor_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plugin_health_criteria_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_health_check_catalogues" (
    "integration_id" TEXT NOT NULL,
    "pipeline" TEXT NOT NULL,
    "checks" JSONB NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_health_check_catalogues_pkey" PRIMARY KEY ("integration_id")
);

-- CreateIndex
CREATE INDEX "plugin_health_criteria_integration_id_idx" ON "plugin_health_criteria"("integration_id");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_health_criteria_revisions_claim_id_revision_key" ON "plugin_health_criteria_revisions"("claim_id", "revision");

-- AddForeignKey
ALTER TABLE "plugin_health_criteria" ADD CONSTRAINT "plugin_health_criteria_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "assurance_elements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_health_criteria" ADD CONSTRAINT "plugin_health_criteria_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_health_criteria_revisions" ADD CONSTRAINT "plugin_health_criteria_revisions_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "assurance_elements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_health_check_catalogues" ADD CONSTRAINT "plugin_health_check_catalogues_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
