-- Case import defeater fidelity fix: adds the dangling-defeat indicator that
-- case-import-service.ts's resolveImportedDefeatsElementId sets when an
-- imported defeater's defeatsElementId doesn't resolve within the same
-- import (Chris's ruling 2026-09-14: import anyway, blank the reference,
-- flag it — mirrors citation_dangling, added by
-- 20260719010000_add_element_cited_element_id). Additive only — no backfill,
-- no behaviour change for existing rows.

-- AlterTable
ALTER TABLE "assurance_elements" ADD COLUMN "defeats_dangling" BOOLEAN NOT NULL DEFAULT false;
