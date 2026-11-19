-- Record which token replaced a rotated one.
--
-- Additive only: one nullable column, a unique index (a token replaces at most
-- one other) and a foreign key to the same table. No existing row is written,
-- so tokens rotated earlier simply have no link.
ALTER TABLE "api_tokens" ADD COLUMN "replaced_by_token_id" TEXT;

CREATE UNIQUE INDEX "api_tokens_replaced_by_token_id_key" ON "api_tokens"("replaced_by_token_id");

ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_replaced_by_token_id_fkey" FOREIGN KEY ("replaced_by_token_id") REFERENCES "api_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
