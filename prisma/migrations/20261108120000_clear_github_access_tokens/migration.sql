-- Clear every stored GitHub access token.
--
-- GitHub sign-in now requests only the profile and email scopes. Tokens saved
-- before this change were granted wider access than TEA uses, and a person who
-- signs in another way never replaces theirs, so they are removed here.
-- "github_id" is kept, so signing in with GitHub is unaffected; the next GitHub
-- import asks the person to connect GitHub again.
UPDATE "users"
SET "github_access_token" = NULL,
    "github_token_expires_at" = NULL
WHERE "github_access_token" IS NOT NULL;
