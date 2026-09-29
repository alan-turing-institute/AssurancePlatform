-- Case import module-reference fidelity fix: adds the dangling-module-
-- reference indicator that case-import-service.ts's
-- resolveImportedModuleReferenceId sets when an imported AWAY_GOAL/MODULE's
-- moduleReferenceId doesn't resolve to a case in the target environment
-- (Chris's ruling 2026-09-16: degrade and flag rather than fail the whole
-- import with a P2003 on assurance_elements_module_reference_id_fkey —
-- mirrors defeats_dangling, added by 20260914000000_add_defeats_dangling).
-- Additive only — no backfill, no behaviour change for existing rows.

-- AlterTable
ALTER TABLE "assurance_elements" ADD COLUMN "module_reference_dangling" BOOLEAN NOT NULL DEFAULT false;
