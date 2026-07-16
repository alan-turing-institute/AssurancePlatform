-- ADR 0003 (publishing and Discover) — data layer, first issue in the chain.
-- Three independent changes:
--   1. case_information: the canonical case-information record (ADR §1).
--   2. published_assurance_cases gains a generic-item type discriminator and
--      a stable, name-derived slug (ADR §5, §6).
--   3. publish_status loses READY_TO_PUBLISH (ADR §2/§4) — existing rows map
--      to DRAFT before the enum type is rebuilt without the retired value.

-- ============================================
-- 1. case_information
-- ============================================

-- CreateTable
CREATE TABLE "case_information" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "description" TEXT,
    "authors" VARCHAR(255),
    "sector" VARCHAR(100),
    "feature_image_url" VARCHAR(2000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_information_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "case_information_case_id_key" ON "case_information"("case_id");

-- AddForeignKey
ALTER TABLE "case_information" ADD CONSTRAINT "case_information_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "assurance_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- 2. published_assurance_cases: type discriminator + slug + isCurrent
-- ============================================

-- CreateEnum
CREATE TYPE "PublishableItemType" AS ENUM ('ASSURANCE_CASE', 'ARGUMENT_PATTERN');

-- AlterTable: add `type` with a default so existing rows backfill cleanly
-- (every row published before this migration is, by definition, an
-- assurance case).
ALTER TABLE "published_assurance_cases" ADD COLUMN "type" "PublishableItemType" NOT NULL DEFAULT 'ASSURANCE_CASE';

-- AlterTable: add `is_current` — every row starts `true`, corrected below for
-- cases that already have more than one historical published version (only
-- the latest may stay current).
ALTER TABLE "published_assurance_cases" ADD COLUMN "is_current" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: add `slug` nullable first — it cannot be backfilled until
-- existing rows have a value.
ALTER TABLE "published_assurance_cases" ADD COLUMN "slug" VARCHAR(255);

-- Backfill: derive a slug from each existing row's title using the same
-- normalisation as `slug-service.ts`'s `slugify` (lowercase, non-alphanumerics
-- collapsed to single hyphens, leading/trailing hyphens trimmed, "item" as
-- the fallback for an all-punctuation/empty title), then suffix with the
-- row's own id fragment. The id fragment — not a numeric suffix — is
-- deliberate here: it guarantees uniqueness across this whole backfill in
-- one pass with no self-referential collision loop, which the ordinary
-- runtime path (`generateUniqueSlug`) does not need because it only ever
-- inserts one new row at a time.
UPDATE "published_assurance_cases"
SET "slug" = (
    CASE
        WHEN trim(both '-' from regexp_replace(lower(trim("title")), '[^a-z0-9]+', '-', 'g')) = ''
            THEN 'item'
        ELSE trim(both '-' from regexp_replace(lower(trim("title")), '[^a-z0-9]+', '-', 'g'))
    END
) || '-' || substr("id"::text, 1, 8)
WHERE "slug" IS NULL;

ALTER TABLE "published_assurance_cases" ALTER COLUMN "slug" SET NOT NULL;

-- Correct `is_current` for cases with more than one historical version: only
-- the most recently created row per `assurance_case_id` stays current. Every
-- row defaulted to `true` above, so this only ever flips rows to `false`.
UPDATE "published_assurance_cases" AS pac
SET "is_current" = false
WHERE EXISTS (
    SELECT 1 FROM "published_assurance_cases" AS newer
    WHERE newer."assurance_case_id" = pac."assurance_case_id"
      AND (newer."created_at", newer."id") > (pac."created_at", pac."id")
);

-- CreateIndex: general lookup index (slug is no longer globally unique — see
-- the model comment in schema.prisma).
CREATE INDEX "published_assurance_cases_slug_current_idx" ON "published_assurance_cases"("slug", "is_current");

-- Partial unique index: the actual uniqueness invariant is "no two CURRENT
-- rows share a slug" — two historical (superseded) rows for the SAME case are
-- expected to share one by design (ADR 0003 §6: the slug is stable across
-- republishes). Cannot be expressed as a plain `@@unique` in Prisma's schema
-- DSL (same limitation as `PluginData`'s case-level partial index above),
-- hence raw SQL here. Keep both in sync if this model changes.
CREATE UNIQUE INDEX "published_assurance_cases_slug_is_current_key" ON "published_assurance_cases"("slug") WHERE "is_current";

-- ============================================
-- 3. publish_status: retire READY_TO_PUBLISH
-- ============================================

-- Map existing rows first — the new enum type below has no READY_TO_PUBLISH
-- value to cast into.
UPDATE "assurance_cases" SET "publish_status" = 'DRAFT' WHERE "publish_status" = 'READY_TO_PUBLISH';

-- Postgres has no `ALTER TYPE ... DROP VALUE`, so the enum is rebuilt:
-- create the new type, swap the column over, drop the old type, rename.
CREATE TYPE "PublishStatus_new" AS ENUM ('DRAFT', 'PUBLISHED');
ALTER TABLE "assurance_cases" ALTER COLUMN "publish_status" DROP DEFAULT;
ALTER TABLE "assurance_cases" ALTER COLUMN "publish_status" TYPE "PublishStatus_new" USING ("publish_status"::text::"PublishStatus_new");
ALTER TABLE "assurance_cases" ALTER COLUMN "publish_status" SET DEFAULT 'DRAFT';
DROP TYPE "PublishStatus";
ALTER TYPE "PublishStatus_new" RENAME TO "PublishStatus";
