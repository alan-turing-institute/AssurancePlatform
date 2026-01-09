-- ============================================
-- REMOVE 39 LEGACY DJANGO TABLES
-- ============================================
-- These tables are orphaned after the migration from Django to Next.js/Prisma.
-- They have NO corresponding Prisma model (no @@map directive) and are not
-- used by the application.
--
-- Data was migrated to the new schema via:
-- - prisma/scripts/02-migrate-data.ts
-- - prisma/scripts/04-migrate-legacy-tables.ts
--
-- Old-to-new ID mappings are preserved in the legacy_mappings table.
--
-- Tables KEPT (still mapped in Prisma schema):
-- - api_casestudy, api_casestudy_assurance_cases,
--   api_casestudyfeatureimage, api_publishedassurancecase
-- ============================================

-- ============================================
-- PHASE 1: DROP JUNCTION/LEAF TABLES FIRST
-- (Tables that reference others but are not referenced)
-- ============================================

-- Django Auth junction tables
DROP TABLE IF EXISTS auth_group_permissions CASCADE;

-- Django Allauth email confirmation
DROP TABLE IF EXISTS account_emailconfirmation CASCADE;

-- User junction tables
DROP TABLE IF EXISTS api_eapuser_groups CASCADE;
DROP TABLE IF EXISTS api_eapuser_user_permissions CASCADE;

-- Team membership
DROP TABLE IF EXISTS api_eapgroup_member CASCADE;

-- Case permission junction tables
DROP TABLE IF EXISTS api_assurancecase_edit_groups CASCADE;
DROP TABLE IF EXISTS api_assurancecase_view_groups CASCADE;
DROP TABLE IF EXISTS api_assurancecase_review_groups CASCADE;

-- Case images
DROP TABLE IF EXISTS api_assurancecaseimage CASCADE;

-- Evidence to claim links
DROP TABLE IF EXISTS api_evidence_property_claim CASCADE;

-- Comments (references multiple tables)
DROP TABLE IF EXISTS api_comment CASCADE;

-- Auth tokens
DROP TABLE IF EXISTS authtoken_token CASCADE;

-- Django admin log
DROP TABLE IF EXISTS django_admin_log CASCADE;

-- Social auth tables (user-related)
DROP TABLE IF EXISTS social_auth_usersocialauth CASCADE;
DROP TABLE IF EXISTS socialaccount_socialtoken CASCADE;
DROP TABLE IF EXISTS socialaccount_socialaccount CASCADE;
DROP TABLE IF EXISTS socialaccount_socialapp_sites CASCADE;

-- WebSocket connections
DROP TABLE IF EXISTS websockets_assurancecaseconnection CASCADE;

-- ============================================
-- PHASE 2: DROP INTERMEDIATE TABLES
-- (Tables referenced by Phase 1, reference Phase 3/4)
-- ============================================

-- Email addresses (references api_eapuser)
DROP TABLE IF EXISTS account_emailaddress CASCADE;

-- Context (references case and goal)
DROP TABLE IF EXISTS api_context CASCADE;

-- Evidence (references case)
DROP TABLE IF EXISTS api_evidence CASCADE;

-- Strategy (references case and goal)
DROP TABLE IF EXISTS api_strategy CASCADE;

-- Property claims (self-referential + references case, goal, strategy)
DROP TABLE IF EXISTS api_propertyclaim CASCADE;

-- GitHub repositories (references user)
DROP TABLE IF EXISTS api_githubrepository CASCADE;

-- Social auth app
DROP TABLE IF EXISTS socialaccount_socialapp CASCADE;

-- ============================================
-- PHASE 3: DROP CORE DATA TABLES
-- ============================================

-- Top-level normative goals (references case)
DROP TABLE IF EXISTS api_toplevelnormativegoal CASCADE;

-- Groups/Teams (references user as owner)
DROP TABLE IF EXISTS api_eapgroup CASCADE;

-- Assurance cases (references user as owner)
DROP TABLE IF EXISTS api_assurancecase CASCADE;

-- Users (base table for all user references)
DROP TABLE IF EXISTS api_eapuser CASCADE;

-- ============================================
-- PHASE 4: DROP DJANGO INFRASTRUCTURE TABLES
-- ============================================

-- Auth tables
DROP TABLE IF EXISTS auth_permission CASCADE;
DROP TABLE IF EXISTS auth_group CASCADE;

-- Django core tables
DROP TABLE IF EXISTS django_content_type CASCADE;
DROP TABLE IF EXISTS django_site CASCADE;
DROP TABLE IF EXISTS django_session CASCADE;
DROP TABLE IF EXISTS django_migrations CASCADE;

-- Social auth infrastructure (no dependencies)
DROP TABLE IF EXISTS social_auth_association CASCADE;
DROP TABLE IF EXISTS social_auth_code CASCADE;
DROP TABLE IF EXISTS social_auth_nonce CASCADE;
DROP TABLE IF EXISTS social_auth_partial CASCADE;
