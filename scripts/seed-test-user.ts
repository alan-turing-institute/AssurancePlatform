/**
 * Seeds a test user for development testing.
 * Run with: npx tsx scripts/seed-test-user.ts
 */

import { hashPassword } from "../lib/auth/password-service";
import { prismaNew } from "../lib/prisma";

async function main() {
	const username = "testuser";
	const email = "test@example.com";
	const password = "testpassword123";

	// Check if user already exists
	const existing = await prismaNew.user.findFirst({
		where: {
			OR: [{ username }, { email }],
		},
	});

	if (existing) {
		console.log(
			`User already exists: ${existing.username} (${existing.email})`
		);
		return;
	}

	// Hash the password
	const passwordHash = await hashPassword(password);

	// Create the user
	const user = await prismaNew.user.create({
		data: {
			username,
			email,
			passwordHash,
			passwordAlgorithm: "argon2id",
			firstName: "Test",
			lastName: "User",
		},
	});

	console.log("Test user created:");
	console.log(`  Username: ${username}`);
	console.log(`  Email: ${email}`);
	console.log(`  Password: ${password}`);
	console.log(`  ID: ${user.id}`);
}

main()
	.catch(console.error)
	.finally(() => prismaNew.$disconnect());
