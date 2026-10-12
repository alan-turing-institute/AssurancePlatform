-- Assistant plugin: remove the one-key-per-user table.
--
-- Model keys now live in user_model_connections. Dropping the table also
-- removes its unique index and its foreign key to users. Nothing reads it.

-- DropTable
DROP TABLE IF EXISTS "plugin_assistant_keys";
