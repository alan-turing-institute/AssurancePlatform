-- Health plugin, server core (ADR 0002 v2 §2.1/§3): plugin_health_evidence,
-- the tier-2, plugin-owned, append-only hash-chained evidence log (ADR 0001
-- §2, relocated). One-way FK to the CORE assurance_elements table only — no
-- core table references this one, and no other plugin's table ever will.

-- CreateEnum
CREATE TYPE "PluginHealthEvidenceVerdict" AS ENUM ('PASS', 'FAIL', 'DEGRADED');

-- CreateSequence (backs the chain_sequence autoincrement column)
CREATE SEQUENCE "plugin_health_evidence_chain_sequence_seq";

-- CreateTable
CREATE TABLE "plugin_health_evidence" (
    "id" TEXT NOT NULL,
    "claim_id" TEXT NOT NULL,
    "metric_name" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "threshold" DOUBLE PRECISION,
    "verdict" "PluginHealthEvidenceVerdict" NOT NULL,
    "odd_dimensions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source_system" TEXT NOT NULL,
    "provenance" JSONB NOT NULL,
    "evaluated_at" TIMESTAMP(3) NOT NULL,
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

-- CreateIndex
CREATE UNIQUE INDEX "plugin_health_evidence_chain_sequence_key" ON "plugin_health_evidence"("chain_sequence");

-- CreateIndex
CREATE INDEX "plugin_health_evidence_claim_id_chain_sequence_idx" ON "plugin_health_evidence"("claim_id", "chain_sequence");

-- AddForeignKey
ALTER TABLE "plugin_health_evidence" ADD CONSTRAINT "plugin_health_evidence_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "assurance_elements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
