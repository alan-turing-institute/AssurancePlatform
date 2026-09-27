import { execSync } from "node:child_process";

export default function globalSetup() {
	if (process.env.CI) {
		return;
	}

	if (process.env.E2E_SKIP_DB_RESET === "1") {
		console.log("E2E_SKIP_DB_RESET=1 set; skipping database reset and seed.");
		return;
	}

	console.log("Resetting and seeding database for E2E tests...");
	execSync("npx prisma migrate reset --force --schema=prisma/schema.prisma", {
		stdio: "inherit",
	});
	execSync("npx tsx prisma/seed/dev-seed.ts", { stdio: "inherit" });
}
