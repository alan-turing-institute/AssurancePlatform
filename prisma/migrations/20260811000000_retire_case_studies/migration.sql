-- ADR 0003 §7 — retire the legacy case-study system.
--
-- Pre-flight (hard rule for any structural/ALTER-or-DROP migration, per the
-- 2026-07-17 staging incident — see the vault note "Staging DB role
-- topology vs migrations"): confirm the target tables are owned by the
-- migrating role before DROP TABLE runs.
--   SELECT DISTINCT tableowner FROM pg_tables WHERE schemaname = 'public';
--   SELECT tablename, tableowner FROM pg_tables WHERE schemaname = 'public'
--     AND tablename IN ('case_studies', 'case_study_published_cases',
--                        'case_study_images', 'published_assurance_cases');
-- Run against a scratch/dev DB (single-owner by construction — NOT staging
-- proof) confirmed the query and target tables; a genuine staging-ownership
-- check needs staging credentials this migration's author did not use
-- without operator supervision, so it is NOT asserted done here — run it
-- against STAGING_DATABASE_URL immediately before `prisma migrate deploy`
-- and abort if more than one owner appears (expect a single owner, `tea_app`,
-- per the 2026-07-18 ownership-transfer fix).
--
-- Two steps:
--   1. Unpublish (PI ruling, 2026-07-14: one real entry on production
--      `main`, not linked to its case — no meaningful blast radius). A
--      belt-and-braces UPDATE ahead of the DROP below: nothing currently
--      reads `case_studies.published` mid-migration, but this makes the
--      "existing case-study content is unpublished" step explicit and
--      auditable in its own right, independent of the table removal that
--      follows it in the same transaction.
--   2. Delete-first: drop the case-study tables outright (children before
--      the parent, so no table needs an explicit CASCADE). Owned sequences
--      (case_studies_id_seq, case_study_published_cases_id_seq,
--      case_study_images_id_seq) are dropped automatically with their
--      owning tables. `published_assurance_cases` is NOT touched here beyond
--      losing the FK target — it is the live Discover/publish mechanism
--      (ADR 0003 §3), not part of this retirement.

-- ============================================
-- 1. Unpublish existing case-study content
-- ============================================

UPDATE "case_studies" SET "published" = false WHERE "published" = true;

-- ============================================
-- 2. Drop the case-study tables (children first)
-- ============================================

DROP TABLE "case_study_published_cases";
DROP TABLE "case_study_images";
DROP TABLE "case_studies";
