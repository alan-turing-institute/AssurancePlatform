-- Assistant plugin: one encrypted model-provider key per user.
--
-- Additive only.

-- CreateTable
CREATE TABLE "plugin_assistant_keys" (
    "user_id" TEXT NOT NULL,
    "api_key_encrypted" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "plugin_assistant_keys_user_id_key" ON "plugin_assistant_keys"("user_id");

-- AddForeignKey
ALTER TABLE "plugin_assistant_keys" ADD CONSTRAINT "plugin_assistant_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
