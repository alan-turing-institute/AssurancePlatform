-- Health plugin: evidence format 1.1.
--
-- Records stored under format 0.1 are removed rather than converted: nearly
-- every column changes, and a 0.1 record cannot be read as a 1.1 record. The
-- counts of what is removed are written to the audit log first, so each
-- environment keeps its own figure.

-- Audit the removal (counts taken before anything is deleted).
INSERT INTO "security_audit_logs" ("id", "event_type", "metadata", "created_at")
SELECT
    gen_random_uuid()::text,
    'health_evidence_v01_removed',
    jsonb_build_object(
        'evidence_rows', (SELECT count(*) FROM "plugin_health_evidence"),
        'plugin_data_rows', (SELECT count(*) FROM "plugin_data" WHERE "plugin_id" = 'tea.health')
    ),
    CURRENT_TIMESTAMP;

-- The cached per-claim summaries and the sweep's case-level marker row.
DELETE FROM "plugin_data" WHERE "plugin_id" = 'tea.health';

-- Per-user scoring settings no longer exist.
UPDATE "plugin_state" SET "settings" = NULL WHERE "plugin_id" = 'tea.health';

-- DropTable (the chain_sequence sequence is owned by the column and goes with it)
DROP TABLE "plugin_health_evidence";

-- DropEnum
DROP TYPE "PluginHealthEvidenceVerdict";

-- CreateEnum
CREATE TYPE "PluginHealthEvidenceVerdict" AS ENUM ('PASS', 'MARGINAL', 'FAIL', 'INDETERMINATE');

-- CreateEnum
CREATE TYPE "PluginHealthBindingSource" AS ENUM ('FIRST_RECORD', 'PERSON');

-- CreateEnum
CREATE TYPE "PluginHealthRevocationCause" AS ENUM ('EVIDENCE_DEFECT', 'BINDING_DEFECT', 'DUPLICATE', 'SUPERSEDED', 'OTHER');

-- CreateSequence (backs the chain_sequence autoincrement column)
CREATE SEQUENCE "plugin_health_evidence_chain_sequence_seq";

-- CreateTable
CREATE TABLE "plugin_health_evidence" (
    "id" TEXT NOT NULL,
    "claim_id" TEXT NOT NULL,
    "record" JSONB NOT NULL,
    "record_id" TEXT NOT NULL,
    "record_timestamp" TIMESTAMP(3) NOT NULL,
    "verdict" "PluginHealthEvidenceVerdict" NOT NULL,
    "check_name" TEXT NOT NULL,
    "session" TEXT NOT NULL,
    "valid_for" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "format_version" TEXT NOT NULL,
    "record_hash" TEXT NOT NULL,
    "previous_record_hash" TEXT,
    "chain_sequence" INTEGER NOT NULL DEFAULT nextval('plugin_health_evidence_chain_sequence_seq'),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plugin_health_evidence_pkey" PRIMARY KEY ("id")
);

-- AlterSequence (tie the sequence's lifetime to the column it backs)
ALTER SEQUENCE "plugin_health_evidence_chain_sequence_seq" OWNED BY "plugin_health_evidence"."chain_sequence";

-- CreateTable
CREATE TABLE "plugin_health_claim_states" (
    "claim_id" TEXT NOT NULL,
    "bound_check_name" TEXT NOT NULL,
    "rejected_since_last_accept" INTEGER NOT NULL DEFAULT 0,
    "stale_notified_at" TIMESTAMP(3),

    CONSTRAINT "plugin_health_claim_states_pkey" PRIMARY KEY ("claim_id")
);

-- CreateTable
CREATE TABLE "plugin_health_binding_changes" (
    "id" TEXT NOT NULL,
    "claim_id" TEXT NOT NULL,
    "from_check_name" TEXT,
    "to_check_name" TEXT NOT NULL,
    "source" "PluginHealthBindingSource" NOT NULL,
    "reason" TEXT,
    "changed_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plugin_health_binding_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_health_revocations" (
    "id" TEXT NOT NULL,
    "evidence_id" TEXT NOT NULL,
    "cause" "PluginHealthRevocationCause" NOT NULL,
    "reason" TEXT NOT NULL,
    "revoked_by_id" TEXT NOT NULL,
    "revoked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reinstated_by_id" TEXT,
    "reinstated_at" TIMESTAMP(3),
    "reinstatement_reason" TEXT,

    CONSTRAINT "plugin_health_revocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plugin_health_evidence_record_id_key" ON "plugin_health_evidence"("record_id");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_health_evidence_chain_sequence_key" ON "plugin_health_evidence"("chain_sequence");

-- CreateIndex
CREATE INDEX "plugin_health_evidence_claim_id_chain_sequence_idx" ON "plugin_health_evidence"("claim_id", "chain_sequence");

-- CreateIndex
CREATE INDEX "plugin_health_evidence_claim_id_record_timestamp_idx" ON "plugin_health_evidence"("claim_id", "record_timestamp");

-- CreateIndex
CREATE INDEX "plugin_health_evidence_session_idx" ON "plugin_health_evidence"("session");

-- CreateIndex
CREATE INDEX "plugin_health_binding_changes_claim_id_created_at_idx" ON "plugin_health_binding_changes"("claim_id", "created_at");

-- CreateIndex
CREATE INDEX "plugin_health_revocations_evidence_id_idx" ON "plugin_health_revocations"("evidence_id");

-- A record has at most one open revocation. Partial indexes cannot be
-- expressed in the Prisma schema, so this one is written by hand.
CREATE UNIQUE INDEX "plugin_health_revocations_evidence_id_open_key" ON "plugin_health_revocations"("evidence_id") WHERE "reinstated_at" IS NULL;

-- AddForeignKey
ALTER TABLE "plugin_health_evidence" ADD CONSTRAINT "plugin_health_evidence_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "assurance_elements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_health_claim_states" ADD CONSTRAINT "plugin_health_claim_states_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "assurance_elements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_health_binding_changes" ADD CONSTRAINT "plugin_health_binding_changes_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "assurance_elements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_health_revocations" ADD CONSTRAINT "plugin_health_revocations_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "plugin_health_evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
