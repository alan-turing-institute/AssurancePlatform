-- TEA — Password-reset tokens are plaintext and non-atomic (AP-QA-006).
--
-- The column held the raw 64-character bearer token, readable straight off
-- a database snapshot for the whole 60-minute reset window. From here the
-- application (lib/services/password-reset-service.ts) stores and looks up
-- only a SHA-256 hash of the token; the raw value now exists nowhere but
-- the outbound email. Same no-salt, no-slow-hash pattern as ApiToken
-- (lib/auth/api-token-service.ts hashApiTokenSecret) — the token already
-- carries 256 bits of entropy, so a fast hash is fine.
--
-- Renamed rather than hashed-in-place, so every reader breaks at compile
-- time until updated (see the Prisma schema and the service).
ALTER TABLE "users" RENAME COLUMN "password_reset_token" TO "password_reset_token_hash";

-- Hash every still-live (unexpired) token in place. Without this, a reset
-- link emailed minutes before this deploy would stop working the moment it
-- lands, because the raw token could no longer match a hashed lookup.
UPDATE "users"
SET "password_reset_token_hash" = encode(sha256(convert_to("password_reset_token_hash", 'UTF8')), 'hex')
WHERE "password_reset_token_hash" IS NOT NULL
  AND "password_reset_expires" > now();

-- Anything already expired (or with no expiry on record) is dead weight —
-- clear it rather than hash a token nobody can present a matching raw value
-- for again. Nothing plaintext survives this migration either way.
UPDATE "users"
SET "password_reset_token_hash" = NULL,
    "password_reset_expires" = NULL
WHERE "password_reset_token_hash" IS NOT NULL
  AND ("password_reset_expires" IS NULL OR "password_reset_expires" <= now());
