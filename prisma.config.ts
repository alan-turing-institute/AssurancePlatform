// Prisma configuration for both development and production
// DATABASE_URL is loaded from environment variables (Azure in prod, .env.local in dev via Next.js)
import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

// Load .env file for local development (CLI commands). quiet: true silences
// dotenv's promotional "tip" lines (third-party product ads in a Turing-
// published tool's stdout/CI logs) — see dotenv#quiet, dotenv >=17.
dotenv.config({ quiet: true });

export default defineConfig({
	schema: "prisma/schema.prisma",
	migrations: {
		path: "prisma/migrations",
	},
	datasource: {
		url: env("DATABASE_URL"),
	},
});
