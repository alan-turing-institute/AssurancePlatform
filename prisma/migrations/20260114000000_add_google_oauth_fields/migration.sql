-- Add GOOGLE to AuthProvider enum
ALTER TYPE "AuthProvider" ADD VALUE 'GOOGLE';

-- Add Google OAuth fields to users table
ALTER TABLE "users" ADD COLUMN "google_id" TEXT;
ALTER TABLE "users" ADD COLUMN "google_email" TEXT;
ALTER TABLE "users" ADD COLUMN "google_access_token" TEXT;
ALTER TABLE "users" ADD COLUMN "google_refresh_token" TEXT;
ALTER TABLE "users" ADD COLUMN "google_token_expires_at" TIMESTAMP(3);

-- Create unique index on google_id
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");
