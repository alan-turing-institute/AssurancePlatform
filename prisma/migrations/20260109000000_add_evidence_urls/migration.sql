-- Add urls array column to assurance_elements for multiple evidence URLs
ALTER TABLE "assurance_elements" ADD COLUMN "urls" TEXT[] NOT NULL DEFAULT '{}';

-- Migrate existing url data to urls array (only for non-null, non-empty values)
UPDATE "assurance_elements"
SET "urls" = ARRAY["url"]
WHERE "url" IS NOT NULL AND "url" != '';
