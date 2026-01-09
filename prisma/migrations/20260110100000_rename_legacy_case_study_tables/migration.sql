-- ============================================
-- RENAME 4 LEGACY DJANGO TABLES TO CLEAN CONVENTIONS
-- ============================================
-- Renames:
--   api_casestudy                   -> case_studies
--   api_casestudy_assurance_cases   -> case_study_published_cases
--   api_casestudyfeatureimage       -> case_study_images
--   api_publishedassurancecase      -> published_assurance_cases
--
-- This is a metadata-only operation (no data movement).
-- ============================================

-- ============================================
-- PHASE 1: RENAME TABLES
-- (Children first, then parents)
-- ============================================

ALTER TABLE "api_casestudy_assurance_cases" RENAME TO "case_study_published_cases";
ALTER TABLE "api_casestudyfeatureimage" RENAME TO "case_study_images";
ALTER TABLE "api_publishedassurancecase" RENAME TO "published_assurance_cases";
ALTER TABLE "api_casestudy" RENAME TO "case_studies";

-- ============================================
-- PHASE 2: RENAME PRIMARY KEY CONSTRAINTS
-- ============================================

ALTER INDEX "api_casestudy_assurance_cases_pkey" RENAME TO "case_study_published_cases_pkey";
ALTER INDEX "api_casestudyfeatureimage_pkey" RENAME TO "case_study_images_pkey";
ALTER INDEX "api_publishedassurancecase_pkey" RENAME TO "published_assurance_cases_pkey";
ALTER INDEX "api_casestudy_pkey" RENAME TO "case_studies_pkey";

-- ============================================
-- PHASE 3: RENAME INDEXES
-- ============================================

ALTER INDEX "eap_api_casestudy_owner_id_32cc0f00" RENAME TO "case_studies_owner_id_idx";
ALTER INDEX "eap_api_publishedassurancecase_assurance_case_id_92434322" RENAME TO "published_assurance_cases_assurance_case_id_idx";
ALTER INDEX "eap_api_casestudy_publis_casestudy_id_publishedas_2b4d76e9_uniq" RENAME TO "case_study_published_cases_unique";
ALTER INDEX "eap_api_casestudy_publishe_casestudy_id_a7e4f836" RENAME TO "case_study_published_cases_case_study_id_idx";
ALTER INDEX "eap_api_casestudy_publishe_publishedassurancecase_id_922f4694" RENAME TO "case_study_published_cases_published_case_id_idx";
ALTER INDEX "api_casestudyfeatureimage_case_study_id_key" RENAME TO "case_study_images_case_study_id_key";

-- ============================================
-- PHASE 4: RENAME FOREIGN KEY CONSTRAINTS
-- ============================================

ALTER TABLE "case_studies" RENAME CONSTRAINT "api_casestudy_owner_id_fkey" TO "case_studies_owner_id_fkey";
ALTER TABLE "published_assurance_cases" RENAME CONSTRAINT "api_publishedassurancecase_assurance_case_id_fkey" TO "published_assurance_cases_assurance_case_id_fkey";
ALTER TABLE "case_study_published_cases" RENAME CONSTRAINT "api_casestudy_assurance_cases_casestudy_id_fkey" TO "case_study_published_cases_case_study_id_fkey";
ALTER TABLE "case_study_published_cases" RENAME CONSTRAINT "api_casestudy_assurance_cases_publishedassurancecase_id_fkey" TO "case_study_published_cases_published_case_id_fkey";
ALTER TABLE "case_study_images" RENAME CONSTRAINT "api_casestudyfeatureimage_case_study_id_fkey" TO "case_study_images_case_study_id_fkey";

-- ============================================
-- PHASE 5: RENAME SEQUENCES
-- ============================================

ALTER SEQUENCE "api_casestudy_id_seq" RENAME TO "case_studies_id_seq";
ALTER SEQUENCE "api_casestudy_assurance_cases_id_seq" RENAME TO "case_study_published_cases_id_seq";
ALTER SEQUENCE "api_casestudyfeatureimage_id_seq" RENAME TO "case_study_images_id_seq";
-- Note: published_assurance_cases uses UUID, no sequence to rename
