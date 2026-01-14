-- Add GitHub OAuth token fields to users table for GitHub API access
-- These fields store the encrypted access token from GitHub OAuth flow

ALTER TABLE "users" ADD COLUMN "github_access_token" TEXT;
ALTER TABLE "users" ADD COLUMN "github_token_expires_at" TIMESTAMP(3);
