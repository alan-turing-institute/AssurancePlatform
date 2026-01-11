-- Auth Cleanup: Remove RefreshToken table
-- JWT-only authentication has been stable for 30+ days
-- RefreshToken-based sessions are no longer used

-- Drop the foreign key constraint first
ALTER TABLE "refresh_tokens" DROP CONSTRAINT IF EXISTS "refresh_tokens_user_id_fkey";

-- Drop the indexes
DROP INDEX IF EXISTS "refresh_tokens_user_id_idx";
DROP INDEX IF EXISTS "refresh_tokens_expires_at_idx";

-- Drop the table
DROP TABLE IF EXISTS "refresh_tokens";
