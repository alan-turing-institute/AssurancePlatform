
-- CreateEnum
CREATE TYPE "CaseMode" AS ENUM ('STANDARD', 'ADVANCED');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('DRAFT', 'READY_TO_PUBLISH', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "PermissionLevel" AS ENUM ('VIEW', 'COMMENT', 'EDIT', 'ADMIN');

-- CreateEnum
CREATE TYPE "ElementType" AS ENUM ('GOAL', 'CONTEXT', 'STRATEGY', 'PROPERTY_CLAIM', 'EVIDENCE', 'JUSTIFICATION', 'ASSUMPTION', 'MODULE', 'AWAY_GOAL', 'CONTRACT');

-- CreateEnum
CREATE TYPE "ElementRole" AS ENUM ('TOP_LEVEL', 'SUPPORTING');

-- CreateEnum
CREATE TYPE "ModuleEmbedType" AS ENUM ('COPY', 'REFERENCE');

-- CreateEnum
CREATE TYPE "ReleaseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SnapshotReason" AS ENUM ('INITIAL_PUBLISH', 'UPDATE', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('VISIBLE', 'HIDDEN', 'DELETED');

-- CreateEnum
CREATE TYPE "CaseTypeCategory" AS ENUM ('DOMAIN', 'TECHNIQUE', 'STANDARD');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'GITHUB', 'SYSTEM');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT,
    "password_algorithm" TEXT NOT NULL DEFAULT 'django_pbkdf2',
    "first_name" TEXT,
    "last_name" TEXT,
    "avatar_url" TEXT,
    "auth_provider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
    "github_id" TEXT,
    "github_username" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "password_reset_token" TEXT,
    "password_reset_expires" TIMESTAMP(3),
    "default_case_mode" "CaseMode" NOT NULL DEFAULT 'STANDARD',
    "is_system_user" BOOLEAN NOT NULL DEFAULT false,
    "has_seen_migration_notice" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "user_agent" TEXT,
    "ip_address" TEXT,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "organisation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'MEMBER',
    "invited_by_id" TEXT,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assurance_cases" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "mode" "CaseMode" NOT NULL DEFAULT 'STANDARD',
    "color_profile" TEXT NOT NULL DEFAULT 'default',
    "lock_uuid" TEXT,
    "locked_by_id" TEXT,
    "locked_at" TIMESTAMP(3),
    "source_pattern_id" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "publish_status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "marked_ready_at" TIMESTAMP(3),
    "marked_ready_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assurance_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_permissions" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "permission" "PermissionLevel" NOT NULL,
    "granted_by_id" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_team_permissions" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "permission" "PermissionLevel" NOT NULL,
    "granted_by_id" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_team_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_invites" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "permission" "PermissionLevel" NOT NULL,
    "invite_token" TEXT NOT NULL,
    "invite_expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "accepted_by_id" TEXT,
    "invited_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assurance_elements" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "element_type" "ElementType" NOT NULL,
    "role" "ElementRole",
    "parent_id" TEXT,
    "name" TEXT,
    "description" TEXT NOT NULL,
    "assumption" TEXT,
    "justification" TEXT,
    "context" TEXT[] NOT NULL DEFAULT '{}',
    "url" TEXT,
    "module_reference_id" TEXT,
    "module_embed_type" "ModuleEmbedType",
    "module_public_summary" TEXT,
    "from_pattern" BOOLEAN NOT NULL DEFAULT false,
    "modified_from_pattern" BOOLEAN NOT NULL DEFAULT false,
    "in_sandbox" BOOLEAN NOT NULL DEFAULT false,
    "is_defeater" BOOLEAN NOT NULL DEFAULT false,
    "defeats_element_id" TEXT,
    "level" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT NOT NULL,

    CONSTRAINT "assurance_elements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_links" (
    "id" TEXT NOT NULL,
    "evidence_id" TEXT NOT NULL,
    "claim_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "argument_patterns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "category" TEXT,
    "tags" TEXT[],
    "published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "argument_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pattern_elements" (
    "id" TEXT NOT NULL,
    "pattern_id" TEXT NOT NULL,
    "element_type" "ElementType" NOT NULL,
    "role" "ElementRole",
    "parent_id" TEXT,
    "name" TEXT,
    "description" TEXT NOT NULL,
    "assumption" TEXT,
    "justification" TEXT,
    "url" TEXT,
    "is_placeholder" BOOLEAN NOT NULL DEFAULT false,
    "placeholder_hint" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pattern_elements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pattern_permissions" (
    "id" TEXT NOT NULL,
    "pattern_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "permission" "PermissionLevel" NOT NULL,
    "granted_by_id" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pattern_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pattern_team_permissions" (
    "id" TEXT NOT NULL,
    "pattern_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "permission" "PermissionLevel" NOT NULL,
    "granted_by_id" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pattern_team_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "releases" (
    "id" TEXT NOT NULL,
    "source_case_id" TEXT NOT NULL,
    "published_case_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "current_version" INTEGER NOT NULL DEFAULT 0,
    "authors" TEXT NOT NULL,
    "contact_email" TEXT,
    "category" TEXT,
    "sector" TEXT,
    "tags" TEXT[],
    "status" "ReleaseStatus" NOT NULL DEFAULT 'DRAFT',
    "first_published_at" TIMESTAMP(3),
    "last_updated_at" TIMESTAMP(3),
    "allow_comments" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "release_snapshots" (
    "id" TEXT NOT NULL,
    "release_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "version_label" TEXT,
    "content" JSONB NOT NULL,
    "snapshot_taken_at" TIMESTAMP(3) NOT NULL,
    "snapshot_taken_by_id" TEXT NOT NULL,
    "reason" "SnapshotReason" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "release_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "release_comments" (
    "id" TEXT NOT NULL,
    "release_id" TEXT NOT NULL,
    "element_id" TEXT,
    "parent_comment_id" TEXT,
    "content" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "status" "CommentStatus" NOT NULL DEFAULT 'VISIBLE',
    "hidden_by_id" TEXT,
    "hidden_at" TIMESTAMP(3),
    "hidden_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "release_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "release_images" (
    "id" TEXT NOT NULL,
    "release_id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "alt_text" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,

    CONSTRAINT "release_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "case_id" TEXT,
    "element_id" TEXT,
    "parent_comment_id" TEXT,
    "content" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_by_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_images" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,

    CONSTRAINT "case_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "CaseTypeCategory" NOT NULL,
    "external_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_type_assignments" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "case_type_id" TEXT NOT NULL,
    "assigned_by_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_type_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_repositories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "github_id" TEXT,
    "default_branch" TEXT NOT NULL DEFAULT 'main',
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_mappings" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "legacy_id" BIGINT NOT NULL,
    "new_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legacy_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_github_id_key" ON "users"("github_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "teams_slug_key" ON "teams"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_team_id_user_id_key" ON "team_members"("team_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "case_permissions_case_id_user_id_key" ON "case_permissions"("case_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "case_team_permissions_case_id_team_id_key" ON "case_team_permissions"("case_id", "team_id");

-- CreateIndex
CREATE UNIQUE INDEX "case_invites_invite_token_key" ON "case_invites"("invite_token");

-- CreateIndex
CREATE INDEX "assurance_cases_publish_status_idx" ON "assurance_cases"("publish_status");

-- CreateIndex
CREATE INDEX "assurance_cases_created_by_status_idx" ON "assurance_cases"("created_by_id", "publish_status");

-- CreateIndex
CREATE INDEX "assurance_elements_case_id_idx" ON "assurance_elements"("case_id");

-- CreateIndex
CREATE INDEX "assurance_elements_case_id_element_type_idx" ON "assurance_elements"("case_id", "element_type");

-- CreateIndex
CREATE INDEX "assurance_elements_parent_id_idx" ON "assurance_elements"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_links_evidence_id_claim_id_key" ON "evidence_links"("evidence_id", "claim_id");

-- CreateIndex
CREATE UNIQUE INDEX "pattern_permissions_pattern_id_user_id_key" ON "pattern_permissions"("pattern_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "pattern_team_permissions_pattern_id_team_id_key" ON "pattern_team_permissions"("pattern_id", "team_id");

-- CreateIndex
CREATE UNIQUE INDEX "release_images_release_id_key" ON "release_images"("release_id");

-- CreateIndex
CREATE UNIQUE INDEX "case_images_case_id_key" ON "case_images"("case_id");

-- CreateIndex
CREATE UNIQUE INDEX "case_types_name_key" ON "case_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "case_type_assignments_case_id_case_type_id_key" ON "case_type_assignments"("case_id", "case_type_id");

-- CreateIndex
CREATE INDEX "legacy_mappings_entity_type_new_id_idx" ON "legacy_mappings"("entity_type", "new_id");

-- CreateIndex
CREATE UNIQUE INDEX "legacy_mappings_entity_type_legacy_id_key" ON "legacy_mappings"("entity_type", "legacy_id");

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assurance_cases" ADD CONSTRAINT "assurance_cases_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assurance_cases" ADD CONSTRAINT "assurance_cases_source_pattern_id_fkey" FOREIGN KEY ("source_pattern_id") REFERENCES "argument_patterns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assurance_cases" ADD CONSTRAINT "assurance_cases_marked_ready_by_id_fkey" FOREIGN KEY ("marked_ready_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_permissions" ADD CONSTRAINT "case_permissions_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "assurance_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_permissions" ADD CONSTRAINT "case_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_permissions" ADD CONSTRAINT "case_permissions_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_team_permissions" ADD CONSTRAINT "case_team_permissions_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "assurance_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_team_permissions" ADD CONSTRAINT "case_team_permissions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_invites" ADD CONSTRAINT "case_invites_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "assurance_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assurance_elements" ADD CONSTRAINT "assurance_elements_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "assurance_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assurance_elements" ADD CONSTRAINT "assurance_elements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assurance_elements" ADD CONSTRAINT "assurance_elements_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "assurance_elements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assurance_elements" ADD CONSTRAINT "assurance_elements_defeats_element_id_fkey" FOREIGN KEY ("defeats_element_id") REFERENCES "assurance_elements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assurance_elements" ADD CONSTRAINT "assurance_elements_module_reference_id_fkey" FOREIGN KEY ("module_reference_id") REFERENCES "assurance_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_links" ADD CONSTRAINT "evidence_links_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "assurance_elements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_links" ADD CONSTRAINT "evidence_links_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "assurance_elements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pattern_elements" ADD CONSTRAINT "pattern_elements_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "argument_patterns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pattern_elements" ADD CONSTRAINT "pattern_elements_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "pattern_elements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pattern_permissions" ADD CONSTRAINT "pattern_permissions_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "argument_patterns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pattern_team_permissions" ADD CONSTRAINT "pattern_team_permissions_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "argument_patterns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pattern_team_permissions" ADD CONSTRAINT "pattern_team_permissions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "releases" ADD CONSTRAINT "releases_source_case_id_fkey" FOREIGN KEY ("source_case_id") REFERENCES "assurance_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "releases" ADD CONSTRAINT "releases_published_case_id_fkey" FOREIGN KEY ("published_case_id") REFERENCES "assurance_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_snapshots" ADD CONSTRAINT "release_snapshots_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_comments" ADD CONSTRAINT "release_comments_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_comments" ADD CONSTRAINT "release_comments_element_id_fkey" FOREIGN KEY ("element_id") REFERENCES "assurance_elements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_comments" ADD CONSTRAINT "release_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_comments" ADD CONSTRAINT "release_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "release_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_images" ADD CONSTRAINT "release_images_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "assurance_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_element_id_fkey" FOREIGN KEY ("element_id") REFERENCES "assurance_elements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_images" ADD CONSTRAINT "case_images_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "assurance_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_type_assignments" ADD CONSTRAINT "case_type_assignments_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "assurance_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_type_assignments" ADD CONSTRAINT "case_type_assignments_case_type_id_fkey" FOREIGN KEY ("case_type_id") REFERENCES "case_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_repositories" ADD CONSTRAINT "github_repositories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- CASE STUDIES TABLES
-- Drop legacy Django tables first (they have no user data)
-- ============================================

-- Drop legacy tables if they exist (from Django, empty)
DROP TABLE IF EXISTS api_casestudy_assurance_cases CASCADE;
DROP TABLE IF EXISTS api_casestudyfeatureimage CASCADE;
DROP TABLE IF EXISTS api_casestudy CASCADE;
DROP TABLE IF EXISTS api_publishedassurancecase CASCADE;

-- CreateTable
CREATE TABLE "api_publishedassurancecase" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(255) NOT NULL,
    "content" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assurance_case_id" TEXT NOT NULL,
    "description" VARCHAR(1000),

    CONSTRAINT "api_publishedassurancecase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_casestudy" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "authors" VARCHAR(255),
    "category" VARCHAR(100),
    "published_date" TIMESTAMPTZ(6),
    "last_modified_on" TIMESTAMPTZ(6) NOT NULL,
    "created_on" TIMESTAMPTZ(6) NOT NULL,
    "sector" VARCHAR(100),
    "contact" VARCHAR(254),
    "image" VARCHAR(200),
    "published" BOOLEAN NOT NULL DEFAULT false,
    "owner_id" TEXT,
    "type" VARCHAR(100),

    CONSTRAINT "api_casestudy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_casestudy_assurance_cases" (
    "id" BIGSERIAL NOT NULL,
    "casestudy_id" INTEGER NOT NULL,
    "publishedassurancecase_id" UUID NOT NULL,

    CONSTRAINT "api_casestudy_assurance_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_casestudyfeatureimage" (
    "id" BIGSERIAL NOT NULL,
    "image" VARCHAR(100) NOT NULL,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL,
    "case_study_id" INTEGER NOT NULL,

    CONSTRAINT "api_casestudyfeatureimage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "eap_api_publishedassurancecase_assurance_case_id_92434322" ON "api_publishedassurancecase"("assurance_case_id");

-- CreateIndex
CREATE INDEX "eap_api_casestudy_owner_id_32cc0f00" ON "api_casestudy"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "eap_api_casestudy_publis_casestudy_id_publishedas_2b4d76e9_uniq" ON "api_casestudy_assurance_cases"("casestudy_id", "publishedassurancecase_id");

-- CreateIndex
CREATE INDEX "eap_api_casestudy_publishe_casestudy_id_a7e4f836" ON "api_casestudy_assurance_cases"("casestudy_id");

-- CreateIndex
CREATE INDEX "eap_api_casestudy_publishe_publishedassurancecase_id_922f4694" ON "api_casestudy_assurance_cases"("publishedassurancecase_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_casestudyfeatureimage_case_study_id_key" ON "api_casestudyfeatureimage"("case_study_id");

-- AddForeignKey
ALTER TABLE "api_publishedassurancecase" ADD CONSTRAINT "api_publishedassurancecase_assurance_case_id_fkey" FOREIGN KEY ("assurance_case_id") REFERENCES "assurance_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_casestudy" ADD CONSTRAINT "api_casestudy_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_casestudy_assurance_cases" ADD CONSTRAINT "api_casestudy_assurance_cases_casestudy_id_fkey" FOREIGN KEY ("casestudy_id") REFERENCES "api_casestudy"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "api_casestudy_assurance_cases" ADD CONSTRAINT "api_casestudy_assurance_cases_publishedassurancecase_id_fkey" FOREIGN KEY ("publishedassurancecase_id") REFERENCES "api_publishedassurancecase"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "api_casestudyfeatureimage" ADD CONSTRAINT "api_casestudyfeatureimage_case_study_id_fkey" FOREIGN KEY ("case_study_id") REFERENCES "api_casestudy"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
