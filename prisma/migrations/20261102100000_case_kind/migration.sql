-- A case has a kind: an ordinary CASE, or a PATTERN that other cases are
-- started from. Every existing row is an ordinary case, so the column takes
-- the constant default and no row is rewritten.

-- CreateEnum
CREATE TYPE "CaseKind" AS ENUM ('CASE', 'PATTERN');

-- AlterTable
ALTER TABLE "assurance_cases" ADD COLUMN "kind" "CaseKind" NOT NULL DEFAULT 'CASE';

-- Placeholder columns on elements. A later change gives them behaviour; for
-- now they exist and default to "not a placeholder, no hint".

-- AlterTable
ALTER TABLE "assurance_elements" ADD COLUMN "is_placeholder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "placeholder_hint" VARCHAR(500);

-- The "source pattern" link used to point at the argument_patterns table and
-- nothing ever set it. It now points at another assurance case (the PATTERN
-- the case was started from), so clear any value and re-create the foreign key
-- against assurance_cases under the same name.
UPDATE "assurance_cases" SET "source_pattern_id" = NULL;

-- DropForeignKey
ALTER TABLE "assurance_cases" DROP CONSTRAINT "assurance_cases_source_pattern_id_fkey";

-- AddForeignKey
ALTER TABLE "assurance_cases" ADD CONSTRAINT "assurance_cases_source_pattern_id_fkey" FOREIGN KEY ("source_pattern_id") REFERENCES "assurance_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
