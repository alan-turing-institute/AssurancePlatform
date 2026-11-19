-- Stop keeping typed email addresses in the two attempt-limit tables.
--
-- Password-reset requests and registrations used to be counted under the
-- address a person typed. From here both count a keyed fingerprint of the
-- address: an HMAC keyed from a server secret that the database does not have,
-- so it cannot be computed here. Both limits look back one hour, so the stored
-- rows are deleted rather than rewritten; counts start again from zero for at
-- most an hour.

-- Password-reset attempts: remove every row, then store a fingerprint (null
-- when the server secret is missing) in a column named for what it holds.
DELETE FROM "password_reset_attempts";

ALTER TABLE "password_reset_attempts" RENAME COLUMN "email" TO "email_key";
ALTER TABLE "password_reset_attempts" ALTER COLUMN "email_key" DROP NOT NULL;
ALTER INDEX "password_reset_attempts_email_attempted_at_idx"
  RENAME TO "password_reset_attempts_email_key_attempted_at_idx";

-- Registration attempts: remove the rows that hold a typed address. Sign-in
-- rows already hold fingerprints and are kept so live sign-in pauses stay.
DELETE FROM "rate_limit_attempts"
WHERE "endpoint" = 'register'
  AND "identifier_type" = 'email';
