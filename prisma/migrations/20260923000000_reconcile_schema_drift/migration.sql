-- Reconciles the deployed database with schema.prisma; fixes AP-QA-004.
-- Four differences, each dating from an earlier migration, none previously
-- caught because nothing ran `prisma migrate diff` against a freshly
-- deployed database:
--
-- 1. `pattern_elements.context` (schema.prisma line ~623) was never created
--    by 20251206000000_initial_schema, and no later migration added it.
--    `PatternElement` has no application code reading or writing it today,
--    so this is a schema-only gap — added here exactly as the schema
--    declares it.
-- 2. `assurance_cases.deleted_by_id` was added by 20260117000000_add_soft_delete
--    as a bare TEXT column with no foreign key, even though the schema
--    declares the `CaseDeleter` relation on it. Three days later,
--    20260120000000_add_element_soft_delete added the equivalent column on
--    `assurance_elements` WITH the FK — this migration brings
--    `assurance_cases` into line with that precedent.
-- 3. `comments.resolved_by_id` has been unconstrained since the initial
--    migration, though the schema declares the `CommentResolver` relation.
-- 4. `published_assurance_cases.id` carries a database-level
--    `DEFAULT gen_random_uuid()`, inherited from the Django-era table the
--    initial migration recreated. schema.prisma declares `@default(uuid())`
--    with no `@db.default`, i.e. the Prisma client generates every id; the
--    only writer is `swapCurrentPublishedVersion` in
--    lib/services/publish-service.ts, which never omits `id` from `create`,
--    and nothing else inserts into this table (no raw SQL, no seed). The
--    database default is therefore redundant and is dropped here, rather
--    than added to the schema, to keep the schema the single description
--    of the database — the same policy every other table already follows.
--
-- Users are hard-deleted (user-management-service.ts, ~line 654;
-- integration-registry-service.ts, ~line 748), and columns 2 and 3 have
-- carried no foreign key since they were created — so staging or production
-- may already hold rows whose `deleted_by_id` / `resolved_by_id` reference a
-- user that no longer exists. Adding the constraints would fail on any such
-- row, so each is preceded by an orphan clean-up that nulls exactly those
-- references before the constraint is added.

-- AlterTable
ALTER TABLE "pattern_elements" ADD COLUMN "context" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "published_assurance_cases" ALTER COLUMN "id" DROP DEFAULT;

-- Orphan clean-up before assurance_cases_deleted_by_id_fkey
UPDATE "assurance_cases" SET "deleted_by_id" = NULL
  WHERE "deleted_by_id" IS NOT NULL AND "deleted_by_id" NOT IN (SELECT "id" FROM "users");

-- AddForeignKey
ALTER TABLE "assurance_cases" ADD CONSTRAINT "assurance_cases_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Orphan clean-up before comments_resolved_by_id_fkey
UPDATE "comments" SET "resolved_by_id" = NULL
  WHERE "resolved_by_id" IS NOT NULL AND "resolved_by_id" NOT IN (SELECT "id" FROM "users");

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
