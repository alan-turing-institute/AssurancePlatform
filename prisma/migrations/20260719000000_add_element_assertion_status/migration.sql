-- ADR 0004 D3: per-assertion status core field. Additive only — nullable
-- column, no backfill, no behaviour change for existing rows. Null means
-- "unset" and is interpreted/exported as the SACM default (ASSERTED).

-- CreateEnum
CREATE TYPE "AssertionStatus" AS ENUM ('ASSERTED', 'NEEDS_SUPPORT', 'ASSUMED', 'AXIOMATIC', 'DEFEATED', 'AS_CITED');

-- AlterTable
ALTER TABLE "assurance_elements" ADD COLUMN "assertion_status" "AssertionStatus";
