-- The check's entry in the check list, as it was when the check was last found there.
ALTER TABLE "plugin_health_criteria" ADD COLUMN "check_description" JSONB NOT NULL;
