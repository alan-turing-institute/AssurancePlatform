-- Remove the start of the invitation code from stored security audit entries.
--
-- Refused and failed invitation acceptances used to keep the first eight
-- characters of the code the client sent in the entry's metadata. From here
-- those entries do not carry any part of the code. The key is removed from
-- existing entries and the rest of each entry is kept.
UPDATE "security_audit_logs"
SET "metadata" = "metadata" - 'inviteToken'
WHERE "event_type" IN (
        'invite_acceptance_user_not_found',
        'invite_acceptance_invalid_token',
        'invite_acceptance_expired',
        'invite_acceptance_already_used',
        'invite_acceptance_email_mismatch',
        'invite_acceptance_failed'
      )
  AND "metadata" ? 'inviteToken';
