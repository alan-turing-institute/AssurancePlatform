// Prisma configuration for both development and production
// DATABASE_URL is loaded from environment variables (Azure in prod, .env.local in dev via Next.js)
import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

// Load .env file for local development (CLI commands)
dotenv.config();

export default defineConfig({
	schema: "prisma/schema.prisma",
	migrations: {
		path: "prisma/migrations",
	},
	datasource: {
		url: env("DATABASE_URL"),
	},
});
