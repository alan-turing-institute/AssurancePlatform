-- Users get a display setting for the case diagram: whether it marks a goal,
-- strategy or claim with nothing beneath it. It is on for everyone, so every
-- existing account takes the default and no row is rewritten (PostgreSQL
-- adds a column with a constant default without touching the table's rows).

-- AlterTable
ALTER TABLE "users" ADD COLUMN "show_unsupported_markers" BOOLEAN NOT NULL DEFAULT true;
