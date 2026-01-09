-- Remove unused pessimistic locking fields from assurance_cases
-- These fields were implemented but never used by the frontend.
-- Real-time collaboration uses SSE events instead.

ALTER TABLE "assurance_cases" DROP COLUMN IF EXISTS "lock_uuid";
ALTER TABLE "assurance_cases" DROP COLUMN IF EXISTS "locked_by_id";
ALTER TABLE "assurance_cases" DROP COLUMN IF EXISTS "locked_at";
