-- Model connections: the connections a user has added, and which connection
-- and model does each of their three jobs (chat, decision, embedding).
--
-- Additive only. The existing plugin_assistant_keys table is left as it is.

-- CreateEnum
CREATE TYPE "ModelConnectionType" AS ENUM ('OPENROUTER', 'OLLAMA', 'OPENAI_COMPATIBLE', 'ANTHROPIC');

-- CreateTable
CREATE TABLE "user_model_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "label" VARCHAR(60) NOT NULL,
    "type" "ModelConnectionType" NOT NULL,
    "base_url" TEXT,
    "api_key_encrypted" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_model_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_model_roles" (
    "user_id" TEXT NOT NULL,
    "chat_connection_id" TEXT,
    "chat_model" VARCHAR(200),
    "decision_connection_id" TEXT,
    "decision_model" VARCHAR(200),
    "embedding_connection_id" TEXT,
    "embedding_model" VARCHAR(200),
    "embedding_verified_for" TEXT,
    "embedding_verified_at" TIMESTAMP(3),

    CONSTRAINT "user_model_roles_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE INDEX "user_model_connections_user_id_idx" ON "user_model_connections"("user_id");

-- CreateIndex
CREATE INDEX "user_model_roles_chat_connection_id_idx" ON "user_model_roles"("chat_connection_id");

-- CreateIndex
CREATE INDEX "user_model_roles_decision_connection_id_idx" ON "user_model_roles"("decision_connection_id");

-- CreateIndex
CREATE INDEX "user_model_roles_embedding_connection_id_idx" ON "user_model_roles"("embedding_connection_id");

-- AddForeignKey
ALTER TABLE "user_model_connections" ADD CONSTRAINT "user_model_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_model_roles" ADD CONSTRAINT "user_model_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_model_roles" ADD CONSTRAINT "user_model_roles_chat_connection_id_fkey" FOREIGN KEY ("chat_connection_id") REFERENCES "user_model_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_model_roles" ADD CONSTRAINT "user_model_roles_decision_connection_id_fkey" FOREIGN KEY ("decision_connection_id") REFERENCES "user_model_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_model_roles" ADD CONSTRAINT "user_model_roles_embedding_connection_id_fkey" FOREIGN KEY ("embedding_connection_id") REFERENCES "user_model_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
