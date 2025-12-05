// Prisma config for the NEW schema (migration target)
// This is separate from the main config which points to the introspected Django schema
import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

// Load .env.local for local development
dotenv.config({ path: ".env.local" });

export default defineConfig({
	schema: "prisma/schema.new.prisma",
	migrations: {
		path: "prisma/migrations-new",
	},
	datasource: {
		url: env("DATABASE_URL"),
	},
});
