-- Add CASCADE DELETE to element hierarchy foreign keys
-- Fixes: Orphaned children when parent elements are deleted
-- Issue: AssurancePlatform-7dw

-- Step 1: Clean up existing orphaned AssuranceElements
-- (elements with parentId pointing to non-existent parent)
DELETE FROM "assurance_elements"
WHERE "parent_id" IS NOT NULL
  AND "parent_id" NOT IN (SELECT "id" FROM "assurance_elements");

-- Step 2: Clean up existing orphaned PatternElements
DELETE FROM "pattern_elements"
WHERE "parent_id" IS NOT NULL
  AND "parent_id" NOT IN (SELECT "id" FROM "pattern_elements");

-- Step 3: Update AssuranceElement FK constraint
ALTER TABLE "assurance_elements"
DROP CONSTRAINT "assurance_elements_parent_id_fkey";

ALTER TABLE "assurance_elements"
ADD CONSTRAINT "assurance_elements_parent_id_fkey"
FOREIGN KEY ("parent_id") REFERENCES "assurance_elements"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 4: Update PatternElement FK constraint
ALTER TABLE "pattern_elements"
DROP CONSTRAINT "pattern_elements_parent_id_fkey";

ALTER TABLE "pattern_elements"
ADD CONSTRAINT "pattern_elements_parent_id_fkey"
FOREIGN KEY ("parent_id") REFERENCES "pattern_elements"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
