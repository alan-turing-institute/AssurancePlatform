-- TEA — Data retention: inactive-account deletion warning tracking.
--
-- Two nullable timestamps recording when each stage of the retention
-- warning sequence was sent to a user: a 30-day warning, then a 7-day
-- final reminder. `runRetentionSweep` (lib/services/retention-service.ts)
-- reads them to send each warning exactly once, and to guarantee an
-- account already years overdue on its first-ever sweep can only be
-- warned, never deleted, on that run.
--
-- Both are cleared on every successful login (every place `lastLoginAt`
-- is written, lib/auth/config.ts), so a user who returns after a warning
-- starts a fresh two-year cycle rather than being deleted on a clock that
-- kept running while they were away.
ALTER TABLE "users"
  ADD COLUMN "retention_warning_30_sent_at" TIMESTAMP(3),
  ADD COLUMN "retention_warning_7_sent_at" TIMESTAMP(3);
