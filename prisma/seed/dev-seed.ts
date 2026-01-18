/**
 * Development database seed script.
 *
 * Creates a lightweight, reproducible test dataset for local development.
 * Idempotent: safe to run multiple times (skips if data exists).
 *
 * Run: npx tsx prisma/seed/dev-seed.ts
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import argon2 from "argon2";
import { Pool } from "pg";
import { PrismaClient } from "../../src/generated/prisma";

const __dirname = dirname(fileURLToPath(import.meta.url));

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	throw new Error("DATABASE_URL environment variable is required");
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function hashPassword(password: string): Promise<string> {
	const hash = await argon2.hash(password, {
		type: argon2.argon2id,
		memoryCost: 65_536,
		timeCost: 3,
		parallelism: 4,
	});
	return hash;
}

type Credentials = {
	[username: string]: string;
};

function loadCredentials(): Credentials {
	const credentialsPath = join(__dirname, ".credentials");
	try {
		const content = readFileSync(credentialsPath, "utf-8");
		const credentials: Credentials = {};
		for (const line of content.trim().split("\n")) {
			const [username, password] = line.split(":");
			if (username && password) {
				credentials[username] = password;
			}
		}
		return credentials;
	} catch {
		console.error(
			"Failed to load .credentials file. Using fallback passwords."
		);
		// Fallback passwords that meet validation rules
		return {
			chris: "DevPassword#1",
			alice: "DevPassword#2",
			bob: "DevPassword#3",
			charlie: "DevPassword#4",
		};
	}
}

async function main() {
	console.log("Starting dev seed...");

	// Check if already seeded (idempotent)
	const existingUser = await prisma.user.findUnique({
		where: { username: "chris" },
	});

	if (existingUser) {
		console.log("Database already seeded (found user 'chris'). Skipping...");
		return;
	}

	const credentials = loadCredentials();

	// ============================================
	// 1. CREATE USERS
	// ============================================
	console.log("Creating users...");

	const [chrisHash, aliceHash, bobHash, charlieHash] = await Promise.all([
		hashPassword(credentials.chris),
		hashPassword(credentials.alice),
		hashPassword(credentials.bob),
		hashPassword(credentials.charlie),
	]);

	const chris = await prisma.user.create({
		data: {
			email: "chris@example.com",
			username: "chris",
			passwordHash: chrisHash,
			passwordAlgorithm: "argon2id",
			firstName: "Chris",
			lastName: "Developer",
			authProvider: "LOCAL",
			emailVerified: true,
		},
	});

	const alice = await prisma.user.create({
		data: {
			email: "alice@example.com",
			username: "alice",
			passwordHash: aliceHash,
			passwordAlgorithm: "argon2id",
			firstName: "Alice",
			lastName: "Admin",
			authProvider: "LOCAL",
			emailVerified: true,
		},
	});

	const bob = await prisma.user.create({
		data: {
			email: "bob@example.com",
			username: "bob",
			passwordHash: bobHash,
			passwordAlgorithm: "argon2id",
			firstName: "Bob",
			lastName: "Member",
			authProvider: "LOCAL",
			emailVerified: true,
		},
	});

	const charlie = await prisma.user.create({
		data: {
			email: "charlie@example.com",
			username: "charlie",
			passwordHash: charlieHash,
			passwordAlgorithm: "argon2id",
			firstName: "Charlie",
			lastName: "External",
			authProvider: "LOCAL",
			emailVerified: true,
		},
	});

	console.log("Created users: chris, alice, bob, charlie");

	// ============================================
	// 2. CREATE TEAM
	// ============================================
	console.log("Creating team...");

	const team = await prisma.team.create({
		data: {
			name: "Test Team",
			slug: "test-team",
			description: "A team for testing collaboration features",
			createdById: alice.id,
		},
	});

	// Add team members: alice as ADMIN, bob as MEMBER
	await prisma.teamMember.createMany({
		data: [
			{
				teamId: team.id,
				userId: alice.id,
				role: "ADMIN",
				invitedById: alice.id,
			},
			{
				teamId: team.id,
				userId: bob.id,
				role: "MEMBER",
				invitedById: alice.id,
			},
		],
	});

	console.log(`Created team: ${team.name} with alice (ADMIN) and bob (MEMBER)`);

	// ============================================
	// 3. CREATE ASSURANCE CASES
	// ============================================
	console.log("Creating assurance cases...");

	// 3a. Simple Case (chris) - Draft, no sharing
	const simpleCase = await prisma.assuranceCase.create({
		data: {
			name: "Simple Case",
			description: "A simple assurance case for basic testing",
			createdById: chris.id,
			mode: "STANDARD",
			publishStatus: "DRAFT",
		},
	});

	// Simple case elements: 1 goal -> 2 claims -> 2 evidence
	const simpleGoal = await prisma.assuranceElement.create({
		data: {
			caseId: simpleCase.id,
			elementType: "GOAL",
			role: "TOP_LEVEL",
			name: "G1",
			description: "The system is safe to use",
			createdById: chris.id,
		},
	});

	const simpleClaim1 = await prisma.assuranceElement.create({
		data: {
			caseId: simpleCase.id,
			elementType: "PROPERTY_CLAIM",
			role: "SUPPORTING",
			parentId: simpleGoal.id,
			name: "C1",
			description: "All inputs are validated",
			createdById: chris.id,
		},
	});

	const simpleClaim2 = await prisma.assuranceElement.create({
		data: {
			caseId: simpleCase.id,
			elementType: "PROPERTY_CLAIM",
			role: "SUPPORTING",
			parentId: simpleGoal.id,
			name: "C2",
			description: "Error handling is comprehensive",
			createdById: chris.id,
		},
	});

	const simpleEvidence1 = await prisma.assuranceElement.create({
		data: {
			caseId: simpleCase.id,
			elementType: "EVIDENCE",
			role: "SUPPORTING",
			name: "E1",
			description: "Input validation test report",
			url: "https://example.com/reports/input-validation.pdf",
			createdById: chris.id,
		},
	});

	const simpleEvidence2 = await prisma.assuranceElement.create({
		data: {
			caseId: simpleCase.id,
			elementType: "EVIDENCE",
			role: "SUPPORTING",
			name: "E2",
			description: "Error handling coverage report",
			url: "https://example.com/reports/error-handling.pdf",
			createdById: chris.id,
		},
	});

	// Link evidence to claims
	await prisma.evidenceLink.createMany({
		data: [
			{ evidenceId: simpleEvidence1.id, claimId: simpleClaim1.id },
			{ evidenceId: simpleEvidence2.id, claimId: simpleClaim2.id },
		],
	});

	console.log("Created: Simple Case (Draft, chris)");

	// 3b. Medium Case (chris) - Published, shared with alice
	const mediumCase = await prisma.assuranceCase.create({
		data: {
			name: "Medium Case",
			description: "A more complex assurance case with strategies",
			createdById: chris.id,
			mode: "ADVANCED",
			publishStatus: "PUBLISHED",
			published: true,
			publishedAt: new Date(),
		},
	});

	// Medium case: 1 goal -> 2 strategies -> 4 claims -> 4 evidence
	const mediumGoal = await prisma.assuranceElement.create({
		data: {
			caseId: mediumCase.id,
			elementType: "GOAL",
			role: "TOP_LEVEL",
			name: "G1",
			description: "The ML model is trustworthy and fair",
			context: ["Healthcare diagnostic system", "UK regulatory environment"],
			createdById: chris.id,
		},
	});

	const strategy1 = await prisma.assuranceElement.create({
		data: {
			caseId: mediumCase.id,
			elementType: "STRATEGY",
			role: "SUPPORTING",
			parentId: mediumGoal.id,
			name: "S1",
			description: "Argue over model accuracy and performance",
			justification:
				"Performance metrics are key indicators of trustworthiness",
			createdById: chris.id,
		},
	});

	const strategy2 = await prisma.assuranceElement.create({
		data: {
			caseId: mediumCase.id,
			elementType: "STRATEGY",
			role: "SUPPORTING",
			parentId: mediumGoal.id,
			name: "S2",
			description: "Argue over fairness and bias mitigation",
			justification: "Fairness is essential for ethical deployment",
			createdById: chris.id,
		},
	});

	// Claims under strategies
	const mediumClaim1 = await prisma.assuranceElement.create({
		data: {
			caseId: mediumCase.id,
			elementType: "PROPERTY_CLAIM",
			role: "SUPPORTING",
			parentId: strategy1.id,
			name: "C1",
			description: "Model achieves >95% accuracy on test set",
			createdById: chris.id,
		},
	});

	const mediumClaim2 = await prisma.assuranceElement.create({
		data: {
			caseId: mediumCase.id,
			elementType: "PROPERTY_CLAIM",
			role: "SUPPORTING",
			parentId: strategy1.id,
			name: "C2",
			description: "Model performance is consistent across validation sets",
			createdById: chris.id,
		},
	});

	const mediumClaim3 = await prisma.assuranceElement.create({
		data: {
			caseId: mediumCase.id,
			elementType: "PROPERTY_CLAIM",
			role: "SUPPORTING",
			parentId: strategy2.id,
			name: "C3",
			description: "No significant bias across protected characteristics",
			createdById: chris.id,
		},
	});

	const mediumClaim4 = await prisma.assuranceElement.create({
		data: {
			caseId: mediumCase.id,
			elementType: "PROPERTY_CLAIM",
			role: "SUPPORTING",
			parentId: strategy2.id,
			name: "C4",
			description: "Bias testing follows industry best practices",
			createdById: chris.id,
		},
	});

	// Evidence for medium case
	const mediumEvidence1 = await prisma.assuranceElement.create({
		data: {
			caseId: mediumCase.id,
			elementType: "EVIDENCE",
			role: "SUPPORTING",
			name: "E1",
			description: "Model accuracy evaluation report",
			url: "https://example.com/reports/accuracy.pdf",
			createdById: chris.id,
		},
	});

	const mediumEvidence2 = await prisma.assuranceElement.create({
		data: {
			caseId: mediumCase.id,
			elementType: "EVIDENCE",
			role: "SUPPORTING",
			name: "E2",
			description: "Cross-validation results",
			url: "https://example.com/reports/cross-validation.pdf",
			createdById: chris.id,
		},
	});

	const mediumEvidence3 = await prisma.assuranceElement.create({
		data: {
			caseId: mediumCase.id,
			elementType: "EVIDENCE",
			role: "SUPPORTING",
			name: "E3",
			description: "Fairness metrics dashboard",
			url: "https://example.com/reports/fairness.pdf",
			createdById: chris.id,
		},
	});

	const mediumEvidence4 = await prisma.assuranceElement.create({
		data: {
			caseId: mediumCase.id,
			elementType: "EVIDENCE",
			role: "SUPPORTING",
			name: "E4",
			description: "Bias testing methodology document",
			url: "https://example.com/reports/bias-methodology.pdf",
			createdById: chris.id,
		},
	});

	// Link evidence to claims
	await prisma.evidenceLink.createMany({
		data: [
			{ evidenceId: mediumEvidence1.id, claimId: mediumClaim1.id },
			{ evidenceId: mediumEvidence2.id, claimId: mediumClaim2.id },
			{ evidenceId: mediumEvidence3.id, claimId: mediumClaim3.id },
			{ evidenceId: mediumEvidence4.id, claimId: mediumClaim4.id },
		],
	});

	// Share with alice (EDIT permission)
	await prisma.casePermission.create({
		data: {
			caseId: mediumCase.id,
			userId: alice.id,
			permission: "EDIT",
			grantedById: chris.id,
		},
	});

	console.log("Created: Medium Case (Published, chris, shared with alice)");

	// 3c. Alice's Case - Draft, team shared
	const aliceCase = await prisma.assuranceCase.create({
		data: {
			name: "Alice's Case",
			description: "A case owned by Alice with team sharing",
			createdById: alice.id,
			mode: "STANDARD",
			publishStatus: "DRAFT",
		},
	});

	// Simple structure for Alice's case
	const aliceGoal = await prisma.assuranceElement.create({
		data: {
			caseId: aliceCase.id,
			elementType: "GOAL",
			role: "TOP_LEVEL",
			name: "G1",
			description: "Team collaboration is effective",
			createdById: alice.id,
		},
	});

	const aliceClaim = await prisma.assuranceElement.create({
		data: {
			caseId: aliceCase.id,
			elementType: "PROPERTY_CLAIM",
			role: "SUPPORTING",
			parentId: aliceGoal.id,
			name: "C1",
			description: "All team members can access shared resources",
			createdById: alice.id,
		},
	});

	const aliceEvidence = await prisma.assuranceElement.create({
		data: {
			caseId: aliceCase.id,
			elementType: "EVIDENCE",
			role: "SUPPORTING",
			name: "E1",
			description: "Team access audit log",
			url: "https://example.com/reports/team-access.pdf",
			createdById: alice.id,
		},
	});

	await prisma.evidenceLink.create({
		data: { evidenceId: aliceEvidence.id, claimId: aliceClaim.id },
	});

	// Share with team
	await prisma.caseTeamPermission.create({
		data: {
			caseId: aliceCase.id,
			teamId: team.id,
			permission: "EDIT",
			grantedById: alice.id,
		},
	});

	console.log(`Created: Alice's Case (Draft, alice, team shared)`);

	// 3d. Bob's Case - Draft, shared with charlie (external)
	const bobCase = await prisma.assuranceCase.create({
		data: {
			name: "Bob's Case",
			description: "A case owned by Bob shared with external user",
			createdById: bob.id,
			mode: "STANDARD",
			publishStatus: "DRAFT",
		},
	});

	const bobGoal = await prisma.assuranceElement.create({
		data: {
			caseId: bobCase.id,
			elementType: "GOAL",
			role: "TOP_LEVEL",
			name: "G1",
			description: "External collaboration works correctly",
			createdById: bob.id,
		},
	});

	const bobClaim = await prisma.assuranceElement.create({
		data: {
			caseId: bobCase.id,
			elementType: "PROPERTY_CLAIM",
			role: "SUPPORTING",
			parentId: bobGoal.id,
			name: "C1",
			description: "External users can view shared cases",
			createdById: bob.id,
		},
	});

	const bobEvidence = await prisma.assuranceElement.create({
		data: {
			caseId: bobCase.id,
			elementType: "EVIDENCE",
			role: "SUPPORTING",
			name: "E1",
			description: "External access verification",
			url: "https://example.com/reports/external-access.pdf",
			createdById: bob.id,
		},
	});

	await prisma.evidenceLink.create({
		data: { evidenceId: bobEvidence.id, claimId: bobClaim.id },
	});

	// Share with charlie (VIEW permission)
	await prisma.casePermission.create({
		data: {
			caseId: bobCase.id,
			userId: charlie.id,
			permission: "VIEW",
			grantedById: bob.id,
		},
	});

	console.log(`Created: Bob's Case (Draft, bob, shared with charlie)`);

	// ============================================
	// 4. CREATE COMMENTS (for collaboration testing)
	// ============================================
	console.log("Creating comments...");

	// Comments on Medium Case from alice
	await prisma.comment.create({
		data: {
			caseId: mediumCase.id,
			content:
				"This looks like a solid structure for the ML trustworthiness argument.",
			authorId: alice.id,
		},
	});

	await prisma.comment.create({
		data: {
			elementId: mediumClaim3.id,
			content:
				"Should we add more detail about which protected characteristics were tested?",
			authorId: alice.id,
		},
	});

	console.log("Created: 2 comments on Medium Case from alice");

	// ============================================
	// SUMMARY
	// ============================================
	console.log("\n========================================");
	console.log("Dev seed completed successfully!");
	console.log("========================================");
	console.log("\nCreated:");
	console.log("  - 4 users: chris, alice, bob, charlie");
	console.log("  - 1 team: Test Team (alice=ADMIN, bob=MEMBER)");
	console.log("  - 4 assurance cases:");
	console.log("    - Simple Case (chris, Draft)");
	console.log("    - Medium Case (chris, Published, shared with alice)");
	console.log("    - Alice's Case (alice, Draft, team shared)");
	console.log("    - Bob's Case (bob, Draft, shared with charlie)");
	console.log("  - 2 comments on Medium Case");
	console.log("\nLogin credentials are in prisma/seed/.credentials");
}

main()
	.catch((e) => {
		console.error("Seed failed:", e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
		await pool.end();
	});
