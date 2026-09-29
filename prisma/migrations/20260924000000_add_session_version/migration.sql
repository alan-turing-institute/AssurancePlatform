-- TEA — Password events do not revoke JWT sessions (AP-QA-003).
--
-- A per-user session version, stamped into the JWT at sign-in and checked
-- on every server-side session read (lib/auth/session-version.ts,
-- callbacks.jwt in lib/auth/config.ts). Bumped atomically alongside the
-- password hash in both changePassword (lib/services/
-- user-management-service.ts) and resetPassword (lib/services/
-- password-reset-service.ts), so a token issued before either event is
-- rejected afterwards. No other write path bumps this column — OAuth
-- sign-in/link and requestPasswordReset leave it untouched.
--
-- Defaulting to 1 (not 0) matches the value every freshly signed-in JWT is
-- stamped with, so an existing row needs no backfill beyond this default.
ALTER TABLE "users"
  ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 1;
