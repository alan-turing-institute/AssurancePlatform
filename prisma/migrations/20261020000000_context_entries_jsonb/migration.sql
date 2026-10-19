-- Context entries: the list of text in assurance_elements.context becomes a
-- JSON list, so that an entry can be plain text or a named entry (a record
-- with an id, a name, a text and an optional value).
--
-- Every existing list becomes a JSON list of the same strings in the same
-- order, and nothing else changes: each entry starts as plain text. A NULL
-- inside a list (which a PostgreSQL text list allows, though the application
-- never wrote one) is dropped, since JSON has nowhere to keep it.
--
-- Hand-written. PostgreSQL will not convert the column's default by itself,
-- so the default is dropped before the type changes and set again after.
-- The statements Prisma generates for this change drop the column and add it
-- back, which would lose every entry.

-- AlterTable
ALTER TABLE "assurance_elements" ALTER COLUMN "context" DROP DEFAULT;

-- AlterTable
ALTER TABLE "assurance_elements" ALTER COLUMN "context" TYPE JSONB USING to_jsonb(array_remove("context", NULL));

-- AlterTable
ALTER TABLE "assurance_elements" ALTER COLUMN "context" SET DEFAULT '[]';
