-- Case invitation codes are stored as a SHA-256 hash, not as issued.
--
-- The column held the raw 64-character code that opens an invitation, readable
-- straight off a database snapshot for the whole seven-day invitation life.
-- From here the application stores and looks up only a SHA-256 hash of the
-- code; the raw value exists only in the link given to the inviter. The code
-- carries 256 bits of entropy, so a fast unsalted hash is enough.
ALTER TABLE "case_invites" RENAME COLUMN "invite_token" TO "invite_token_hash";
ALTER INDEX "case_invites_invite_token_key" RENAME TO "case_invites_invite_token_hash_key";

-- Hash every stored code in place, so a link already sent still matches the
-- hash of the code it carries and keeps its original expiry.
UPDATE "case_invites"
SET "invite_token_hash" = encode(sha256(convert_to("invite_token_hash", 'UTF8')), 'hex');
