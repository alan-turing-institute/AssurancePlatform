// globalSetup for integration tests
// Creates tea_test database and runs migrations
import { execSync } from "node:child_process";
import path from "node:path";
import { Pool } from "pg";

// Resolve project root from this file's location (src/__tests__/scripts/)
const PROJECT_ROOT = path.resolve(__dirname, "../../..");

export async function setup() {
	// Connect to tea_dev (guaranteed to exist) to create tea_test
	const adminPool = new Pool({
		connectionString:
			"postgresql://tea_user:tea_password@localhost:5432/tea_dev",
	});

	try {
		// Check if tea_test exists
		const result = await adminPool.query(
			"SELECT 1 FROM pg_database WHERE datname = 'tea_test'"
		);

		if (result.rowCount === 0) {
			await adminPool.query("CREATE DATABASE tea_test");
			console.log("Created tea_test database");
		}
	} finally {
		await adminPool.end();
	}

	// Run migrations against tea_test
	execSync("npx prisma migrate deploy --schema=prisma/schema.prisma", {
		env: {
			...process.env,
			DATABASE_URL:
				"postgresql://tea_user:tea_password@localhost:5432/tea_test",
		},
		stdio: "pipe",
		cwd: PROJECT_ROOT,
	});
	console.log("Migrations applied to tea_test");
}
