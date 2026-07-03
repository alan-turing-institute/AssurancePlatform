-- Extension foundations (ADR 0002 v2 §2.1, §2.2, §2.4): PluginData (tier-1
-- namespaced plugin storage), PluginState (hierarchical enablement),
-- Integration + ApiToken (machine-access pillar, renamed from
-- PluginRegistration in ADR 0002 v1). Schema and one migration only — no
-- plugin-owned (tier-2) tables here; those ship with their own plugin's
-- work item.

-- CreateEnum
CREATE TYPE "PluginScopeType" AS ENUM ('ORGANISATION', 'TEAM', 'USER');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateTable
CREATE TABLE "plugin_data" (
    "id" TEXT NOT NULL,
    "plugin_id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "element_id" TEXT,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_state" (
    "id" TEXT NOT NULL,
    "plugin_id" TEXT NOT NULL,
    "scope_type" "PluginScopeType" NOT NULL,
    "scope_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "settings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "owner_id" TEXT NOT NULL,
    "system_user_id" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "IntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3),

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_tokens" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "token_prefix" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plugin_data_plugin_id_case_id_element_id_key" ON "plugin_data"("plugin_id", "case_id", "element_id");

-- CreateIndex
CREATE INDEX "plugin_data_case_id_plugin_id_idx" ON "plugin_data"("case_id", "plugin_id");

-- Partial unique index: Postgres treats NULL <> NULL, so the @@unique above
-- (pluginId, caseId, elementId) does not constrain case-level rows
-- (elementId IS NULL) — this closes that gap by keying case-level rows on
-- (pluginId, caseId) alone. Cannot be expressed in Prisma's schema DSL (see
-- the comment on the PluginData model), hence raw SQL here.
CREATE UNIQUE INDEX "plugin_data_plugin_id_case_id_case_level_key" ON "plugin_data"("plugin_id", "case_id") WHERE "element_id" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "plugin_state_plugin_id_scope_type_scope_id_key" ON "plugin_state"("plugin_id", "scope_type", "scope_id");

-- CreateIndex
CREATE UNIQUE INDEX "integrations_name_key" ON "integrations"("name");

-- CreateIndex
CREATE UNIQUE INDEX "integrations_system_user_id_key" ON "integrations"("system_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_tokens_token_hash_key" ON "api_tokens"("token_hash");

-- AddForeignKey
ALTER TABLE "plugin_data" ADD CONSTRAINT "plugin_data_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "assurance_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_data" ADD CONSTRAINT "plugin_data_element_id_fkey" FOREIGN KEY ("element_id") REFERENCES "assurance_elements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_system_user_id_fkey" FOREIGN KEY ("system_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
