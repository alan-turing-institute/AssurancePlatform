-- NOT APPLIED BY PRISMA. Prisma applies only migration.sql, so this file is
-- never run by `prisma migrate deploy`; it is kept here for an operator who
-- has to put the column back by hand.
--
-- Turns assurance_elements.context from a JSON list back into a list of text:
-- add a text-list column, copy, drop the old column, rename.
--
-- Lossless only while no entry has a name. A named entry has no text form, so
-- it would be copied as its JSON text and lose its meaning as a record. The
-- column ends up last in the table, not in its original position.
--
-- The statements run in one transaction, so a failure part-way leaves the
-- column as it was.
--
-- Prisma keeps a row for this migration in "_prisma_migrations". Remove that
-- row when this script is run, or Prisma will treat the migration as applied
-- and will not apply it again:
--   DELETE FROM "_prisma_migrations"
--   WHERE "migration_name" = '20261020000000_context_entries_jsonb';

BEGIN;

ALTER TABLE "assurance_elements" ADD COLUMN "context_text" TEXT[] NOT NULL DEFAULT '{}';

UPDATE "assurance_elements"
SET "context_text" = ARRAY(
	SELECT entry
	FROM jsonb_array_elements_text("context") WITH ORDINALITY AS t(entry, position)
	ORDER BY position
);

ALTER TABLE "assurance_elements" DROP COLUMN "context";

ALTER TABLE "assurance_elements" RENAME COLUMN "context_text" TO "context";

COMMIT;
