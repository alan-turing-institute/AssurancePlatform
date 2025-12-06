// Prisma configuration for both development and production
// DATABASE_URL is loaded from environment variables (Azure in prod, .env.local in dev via Next.js)
import { defineConfig, env } from "prisma/config";

export default defineConfig({
	schema: "prisma/schema.prisma",
	migrations: {
		path: "prisma/migrations",
	},
	datasource: {
		url: env("DATABASE_URL"),
	},
});
