-- Backfill: delete integration system users orphaned by the OLD
-- `deleteIntegrationRegistration` bug (fixed in
-- `lib/services/integration-registry-service.ts`, 2026-07-14 — that fix
-- only stops NEW orphans; it does nothing for ones the old code already
-- left behind). An orphaned system user's unique `username`/`email` blocks
-- same-name re-registration forever (staging carries exactly this case:
-- `integration-darter-pipeline`). This is data-only — no schema change.
--
-- Scope is deliberately narrow, requiring ALL of:
--   1. `is_system_user = true`
--   2. `username LIKE 'integration-%'`   (registerIntegration's own shape:
--      `integration-${slug}`)
--   3. `email LIKE 'integration+%@tea-platform.internal'` (same call's
--      `integration+${slug}@tea-platform.internal`)
--   4. no `integrations` row references it via `system_user_id` (i.e. it is
--      actually orphaned, not a live integration's principal)
--
-- CRITICAL EXCLUSION: the generic fallback system account created by
-- `getOrCreateSystemUser` (`lib/services/user-management-service.ts`,
-- ~line 290) is a deliberately separate account used for ownership
-- transfer when a human user is deleted. Its username/email are the fixed
-- literals `system` / `system@tea-platform.internal` — neither matches the
-- `integration-%` / `integration+%@...` shapes above, so condition 2+3
-- alone already excludes it; it is also never referenced by
-- `integrations.system_user_id` (condition 4 would exclude it a second way
-- even if its naming ever changed to something that collided with 2/3).
--
-- `case_permissions` rows held by a deleted orphan cascade automatically
-- (`case_permissions.user_id` is `ON DELETE CASCADE` onto `users` — see
-- `prisma/schema.prisma`); no separate cleanup statement is needed here.
DELETE FROM users
WHERE is_system_user = true
  AND username LIKE 'integration-%'
  AND email LIKE 'integration+%@tea-platform.internal'
  AND NOT EXISTS (
    SELECT 1 FROM integrations WHERE integrations.system_user_id = users.id
  );
