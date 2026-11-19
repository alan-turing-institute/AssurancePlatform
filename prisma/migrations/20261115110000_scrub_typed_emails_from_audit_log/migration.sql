-- Remove typed email addresses from stored security audit entries.
--
-- Password-reset requests that were refused, registration attempts that hit
-- the rate limit and invitation acceptances that were refused used to keep the
-- address a person typed in the entry's metadata. From here those entries hold
-- a keyed fingerprint of the address instead. The fingerprint is an HMAC
-- keyed from a server secret that the database does not have, so it cannot be
-- computed here: the address fields are removed from existing entries and the
-- rest of each entry is kept.
UPDATE "security_audit_logs"
SET "metadata" = "metadata" - 'email'
WHERE "event_type" IN (
        'password_reset_rate_limited',
        'password_reset_requested_invalid_user'
      )
  AND "metadata" ? 'email';

UPDATE "security_audit_logs"
SET "metadata" = jsonb_set("metadata", '{identifiers}', ("metadata"->'identifiers') - 'email')
WHERE "event_type" = 'register_rate_limited'
  AND jsonb_typeof("metadata"->'identifiers') = 'object'
  AND ("metadata"->'identifiers') ? 'email';

UPDATE "security_audit_logs"
SET "metadata" = "metadata" - 'inviteEmail' - 'userEmail'
WHERE "event_type" IN (
        'invite_acceptance_invalid_token',
        'invite_acceptance_expired',
        'invite_acceptance_already_used',
        'invite_acceptance_email_mismatch'
      )
  AND ("metadata" ? 'inviteEmail' OR "metadata" ? 'userEmail');

-- A failed password-reset email stored the email provider's own error text,
-- which can quote the recipient's address. Entries whose text contains an
-- address get the fixed message the service now writes.
UPDATE "security_audit_logs"
SET "metadata" = jsonb_set("metadata", '{error}', '"Email sending failed"')
WHERE "event_type" = 'password_reset_email_failed'
  AND jsonb_typeof("metadata"->'error') = 'string'
  AND "metadata"->>'error' LIKE '%@%';
