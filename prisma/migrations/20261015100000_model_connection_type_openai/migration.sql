-- Model connections: a connection type for OpenAI's own service.
--
-- Additive only. No existing connection changes. The new value is not used by
-- any statement in this migration: Postgres does not allow a value added in a
-- transaction to be used in the same one.

-- AlterEnum
ALTER TYPE "ModelConnectionType" ADD VALUE 'OPENAI';
