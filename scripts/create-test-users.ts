import { PrismaPg } from "@prisma/adapter-pg";
import argon2 from "argon2";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma-new";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	throw new Error("DATABASE_URL environment variable is required");
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
	// Hash the password using argon2id
	const passwordHash = await argon2.hash("password123", {
		type: argon2.argon2id,
		memoryCost: 65_536,
		timeCost: 3,
		parallelism: 4,
	});
	console.log("Generated password hash for 'password123'");

	// Create a test user with placeholder email (simulates missing email)
	const testUser = await prisma.user.upsert({
		where: { username: "test_no_email" },
		update: {
			hasSeenMigrationNotice: false,
			passwordHash,
			passwordAlgorithm: "argon2id",
		},
		create: {
			username: "test_no_email",
			email: "test_no_email@placeholder.local",
			passwordHash,
			passwordAlgorithm: "argon2id",
			hasSeenMigrationNotice: false,
			authProvider: "LOCAL",
		},
	});
	console.log("Created test user (no email):", {
		username: testUser.username,
		email: testUser.email,
		hasSeenMigrationNotice: testUser.hasSeenMigrationNotice,
	});

	// Also create a user WITH valid email for comparison
	const testUserWithEmail = await prisma.user.upsert({
		where: { username: "test_with_email" },
		update: {
			hasSeenMigrationNotice: false,
			passwordHash,
			passwordAlgorithm: "argon2id",
		},
		create: {
			username: "test_with_email",
			email: "test_with_email@example.com",
			passwordHash,
			passwordAlgorithm: "argon2id",
			hasSeenMigrationNotice: false,
			authProvider: "LOCAL",
		},
	});
	console.log("Created test user (with email):", {
		username: testUserWithEmail.username,
		email: testUserWithEmail.email,
		hasSeenMigrationNotice: testUserWithEmail.hasSeenMigrationNotice,
	});

	console.log("\n=== Test Credentials ===");
	console.log("User without email:");
	console.log("  Username: test_no_email");
	console.log("  Password: password123");
	console.log("\nUser with email:");
	console.log("  Username: test_with_email");
	console.log("  Password: password123");
}

main()
	.catch(console.error)
	.finally(async () => {
		await prisma.$disconnect();
		await pool.end();
	});
