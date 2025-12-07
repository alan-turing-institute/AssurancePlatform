/**
 * Duplicate User Resolution Script
 *
 * This script resolves duplicate users in the TEA Platform database.
 * Duplicate users occur when the same person creates multiple accounts
 * (e.g., legacy account + GitHub OAuth account with same email).
 *
 * Strategy:
 * 1. Find all email addresses with multiple user accounts
 * 2. For each duplicate group, identify the PRIMARY account
 *    - Account with most owned data wins
 *    - If tied, prefer better username (non-random)
 * 3. Transfer all owned data to PRIMARY account
 * 4. Delete SECONDARY account(s)
 *
 * Usage:
 *   pnpm exec tsx prisma/scripts/01-resolve-duplicate-users.ts --dry-run
 *   pnpm exec tsx prisma/scripts/01-resolve-duplicate-users.ts --execute
 */

import dotenv from "dotenv";
import postgres from "postgres";

// Load environment variables
dotenv.config({ path: ".env.local" });

// Use raw postgres client for migration scripts (simpler than Prisma for raw SQL)
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	throw new Error("DATABASE_URL environment variable is not set");
}

const sql = postgres(connectionString);

// Top-level regex patterns for username validation
const ALPHANUMERIC_PATTERN = /^[a-zA-Z0-9]+$/;
const UPPERCASE_PATTERN = /[A-Z]/;
const LOWERCASE_PATTERN = /[a-z]/;
const DIGIT_PATTERN = /[0-9]/;

type DuplicateGroup = {
	email: string;
	userIds: bigint[];
	usernames: string[];
	authProviders: string[];
	lastLogins: (Date | null)[];
};

type UserDataCounts = {
	userId: bigint;
	username: string;
	authProvider: string;
	lastLogin: Date | null;
	ownedCases: number;
	ownedGroups: number;
	comments: number;
	totalScore: number;
};

type NotificationRecord = {
	email: string;
	primaryUsername: string;
	mergedUsernames: string[];
	totalCases: number;
	totalGroups: number;
	totalComments: number;
};

type ResolutionPlan = {
	email: string;
	primaryUserId: bigint;
	primaryUsername: string;
	secondaryUserIds: bigint[];
	dataToTransfer: {
		cases: number;
		groups: number;
		comments: number;
	};
};

async function findDuplicateEmailGroups(): Promise<DuplicateGroup[]> {
	const result = await sql<
		Array<{
			email: string;
			user_ids: string[];
			usernames: string[];
			auth_providers: string[];
			last_logins: (Date | null)[];
		}>
	>`
    SELECT
      email,
      array_agg(id ORDER BY id) as user_ids,
      array_agg(username ORDER BY id) as usernames,
      array_agg(auth_provider ORDER BY id) as auth_providers,
      array_agg(last_login ORDER BY id) as last_logins
    FROM api_eapuser
    WHERE email != '' AND email IS NOT NULL
    GROUP BY email
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `;

	return result.map((row) => ({
		email: row.email,
		userIds: row.user_ids.map((id) => BigInt(id)),
		usernames: row.usernames,
		authProviders: row.auth_providers,
		lastLogins: row.last_logins,
	}));
}

async function getUserDataCounts(userId: bigint): Promise<{
	ownedCases: number;
	ownedGroups: number;
	comments: number;
}> {
	// Convert BigInt to Number for SQL compatibility
	const userIdNum = Number(userId);
	const [casesResult, groupsResult, commentsResult] = await Promise.all([
		sql<Array<{ count: string }>>`
      SELECT COUNT(*) as count FROM api_assurancecase WHERE owner_id = ${userIdNum}
    `,
		sql<Array<{ count: string }>>`
      SELECT COUNT(*) as count FROM api_eapgroup WHERE owner_id = ${userIdNum}
    `,
		sql<Array<{ count: string }>>`
      SELECT COUNT(*) as count FROM api_comment WHERE author_id = ${userIdNum}
    `,
	]);

	return {
		ownedCases: Number(casesResult[0].count),
		ownedGroups: Number(groupsResult[0].count),
		comments: Number(commentsResult[0].count),
	};
}

function isRandomUsername(username: string): boolean {
	// GitHub OAuth often generates random usernames like "QSj0DqJ0MDVysnK"
	// These are typically 15+ chars of mixed case alphanumeric
	if (username.length >= 15 && ALPHANUMERIC_PATTERN.test(username)) {
		// Check for mixed case which suggests random generation
		const hasUpper = UPPERCASE_PATTERN.test(username);
		const hasLower = LOWERCASE_PATTERN.test(username);
		const hasDigit = DIGIT_PATTERN.test(username);
		if (hasUpper && hasLower && hasDigit) {
			return true;
		}
	}
	return false;
}

function selectPrimaryUser(users: UserDataCounts[]): bigint {
	// Selection priority:
	// 1. Total data owned (cases + groups + comments)
	// 2. Most recent login (if any)
	// 3. Better username (non-random)
	// 4. Lower user ID (older account)

	const sorted = [...users].sort((a, b) => {
		// First, compare by total data owned
		if (b.totalScore !== a.totalScore) {
			return b.totalScore - a.totalScore;
		}

		// If tied on data, prefer most recent login
		const aLogin = a.lastLogin ? a.lastLogin.getTime() : 0;
		const bLogin = b.lastLogin ? b.lastLogin.getTime() : 0;
		if (aLogin !== bLogin) {
			return bLogin - aLogin; // More recent wins
		}

		// If tied, prefer non-random usernames
		const aRandom = isRandomUsername(a.username);
		const bRandom = isRandomUsername(b.username);
		if (aRandom !== bRandom) {
			return aRandom ? 1 : -1; // Non-random wins
		}

		// If still tied, prefer lower user ID (older account)
		return Number(a.userId - b.userId);
	});

	return sorted[0].userId;
}

async function createResolutionPlan(
	group: DuplicateGroup
): Promise<ResolutionPlan> {
	// Get data counts for each user in the group
	const userDataCounts: UserDataCounts[] = await Promise.all(
		group.userIds.map(async (userId, index) => {
			const counts = await getUserDataCounts(userId);
			return {
				userId,
				username: group.usernames[index],
				authProvider: group.authProviders[index],
				lastLogin: group.lastLogins[index],
				...counts,
				totalScore: counts.ownedCases + counts.ownedGroups + counts.comments,
			};
		})
	);

	// Select primary user
	const primaryUserId = selectPrimaryUser(userDataCounts);
	const primaryUser = userDataCounts.find((u) => u.userId === primaryUserId);
	const secondaryUsers = userDataCounts.filter(
		(u) => u.userId !== primaryUserId
	);

	// Calculate data to transfer
	const dataToTransfer = secondaryUsers.reduce(
		(acc, user) => ({
			cases: acc.cases + user.ownedCases,
			groups: acc.groups + user.ownedGroups,
			comments: acc.comments + user.comments,
		}),
		{ cases: 0, groups: 0, comments: 0 }
	);

	return {
		email: group.email,
		primaryUserId,
		primaryUsername: primaryUser?.username ?? "unknown",
		secondaryUserIds: secondaryUsers.map((u) => u.userId),
		dataToTransfer,
	};
}

async function executeResolution(
	plan: ResolutionPlan,
	db: postgres.Sql = sql
): Promise<void> {
	const { primaryUserId, secondaryUserIds } = plan;
	// Convert BigInt to Number for SQL compatibility (postgres library serializes BigInt as text)
	const primaryId = Number(primaryUserId);

	for (const secondaryUserId of secondaryUserIds) {
		const secondaryId = Number(secondaryUserId);
		// Transfer assurance cases
		await db`
      UPDATE api_assurancecase
      SET owner_id = ${primaryId}
      WHERE owner_id = ${secondaryId}
    `;

		// Transfer groups
		await db`
      UPDATE api_eapgroup
      SET owner_id = ${primaryId}
      WHERE owner_id = ${secondaryId}
    `;

		// Transfer comments
		await db`
      UPDATE api_comment
      SET author_id = ${primaryId}
      WHERE author_id = ${secondaryId}
    `;

		// Transfer case studies
		await db`
      UPDATE api_casestudy
      SET owner_id = ${primaryId}
      WHERE owner_id = ${secondaryId}
    `;

		// Transfer GitHub repositories
		await db`
      UPDATE api_githubrepository
      SET owner_id = ${primaryId}
      WHERE owner_id = ${secondaryId}
    `;

		// Transfer group memberships
		// First, remove any existing membership for primary user in groups where secondary is member
		await db`
      DELETE FROM api_eapgroup_member
      WHERE eapuser_id = ${primaryId}
      AND eapgroup_id IN (
        SELECT eapgroup_id FROM api_eapgroup_member WHERE eapuser_id = ${secondaryId}
      )
    `;

		// Then transfer memberships from secondary to primary
		await db`
      UPDATE api_eapgroup_member
      SET eapuser_id = ${primaryId}
      WHERE eapuser_id = ${secondaryId}
    `;

		// Delete auth/session records for secondary user (these don't need to be transferred)
		await db`DELETE FROM account_emailaddress WHERE user_id = ${secondaryId}`;
		await db`DELETE FROM authtoken_token WHERE user_id = ${secondaryId}`;
		await db`DELETE FROM social_auth_usersocialauth WHERE user_id = ${secondaryId}`;
		await db`DELETE FROM socialaccount_socialaccount WHERE user_id = ${secondaryId}`;
		await db`DELETE FROM websockets_assurancecaseconnection WHERE user_id = ${secondaryId}`;
		await db`DELETE FROM django_admin_log WHERE user_id = ${secondaryId}`;
		await db`DELETE FROM api_eapuser_groups WHERE eapuser_id = ${secondaryId}`;
		await db`DELETE FROM api_eapuser_user_permissions WHERE eapuser_id = ${secondaryId}`;

		// Delete secondary user
		await db`
      DELETE FROM api_eapuser WHERE id = ${secondaryId}
    `;
	}
}

async function main() {
	const args = process.argv.slice(2);
	const isDryRun = args.includes("--dry-run") || !args.includes("--execute");

	console.log("=".repeat(60));
	console.log("TEA Platform: Duplicate User Resolution Script");
	console.log("=".repeat(60));
	console.log(`Mode: ${isDryRun ? "DRY RUN (no changes)" : "EXECUTE"}`);
	console.log("");

	try {
		// Find duplicate email groups
		console.log("Finding duplicate email groups...");
		const duplicateGroups = await findDuplicateEmailGroups();
		console.log(`Found ${duplicateGroups.length} duplicate email groups\n`);

		if (duplicateGroups.length === 0) {
			console.log("No duplicate users found. Exiting.");
			return;
		}

		// Create resolution plans
		console.log("Analysing duplicate groups...\n");
		const plans: ResolutionPlan[] = [];

		for (const group of duplicateGroups) {
			const plan = await createResolutionPlan(group);
			plans.push(plan);

			console.log(`Email: ${plan.email}`);
			console.log(
				`  Primary: ID ${plan.primaryUserId} (${plan.primaryUsername})`
			);
			console.log(
				`  Secondary IDs to delete: ${plan.secondaryUserIds.join(", ")}`
			);
			console.log(
				`  Data to transfer: ${plan.dataToTransfer.cases} cases, ${plan.dataToTransfer.groups} groups, ${plan.dataToTransfer.comments} comments`
			);
			console.log("");
		}

		// Summary
		const totalSecondary = plans.reduce(
			(acc, p) => acc + p.secondaryUserIds.length,
			0
		);
		const summaryTotalCases = plans.reduce(
			(acc, p) => acc + p.dataToTransfer.cases,
			0
		);
		const summaryTotalGroups = plans.reduce(
			(acc, p) => acc + p.dataToTransfer.groups,
			0
		);
		const summaryTotalComments = plans.reduce(
			(acc, p) => acc + p.dataToTransfer.comments,
			0
		);

		console.log("=".repeat(60));
		console.log("SUMMARY");
		console.log("=".repeat(60));
		console.log(`Duplicate email groups: ${plans.length}`);
		console.log(`Users to delete: ${totalSecondary}`);
		console.log(`Cases to transfer: ${summaryTotalCases}`);
		console.log(`Groups to transfer: ${summaryTotalGroups}`);
		console.log(`Comments to transfer: ${summaryTotalComments}`);
		console.log("");

		// Generate notification list for later email sending
		const notifications: NotificationRecord[] = await Promise.all(
			plans.map(async (plan) => {
				// Get all usernames being merged
				const primaryIdNum = Number(plan.primaryUserId);
				const allUsers = await sql`
					SELECT username FROM api_eapuser
					WHERE id = ANY(${[plan.primaryUserId, ...plan.secondaryUserIds].map(Number)})
				`;
				const mergedUsernames = allUsers
					.map((u) => u.username)
					.filter((u) => u !== plan.primaryUsername);

				// Get total data for this user after merge
				const userTotalCases =
					plan.dataToTransfer.cases +
					(
						await sql`SELECT COUNT(*) as count FROM api_assurancecase WHERE owner_id = ${primaryIdNum}`
					)[0].count;
				const userTotalGroups =
					plan.dataToTransfer.groups +
					(
						await sql`SELECT COUNT(*) as count FROM api_eapgroup WHERE owner_id = ${primaryIdNum}`
					)[0].count;
				const userTotalComments =
					plan.dataToTransfer.comments +
					(
						await sql`SELECT COUNT(*) as count FROM api_comment WHERE author_id = ${primaryIdNum}`
					)[0].count;

				return {
					email: plan.email,
					primaryUsername: plan.primaryUsername,
					mergedUsernames,
					totalCases: Number(userTotalCases),
					totalGroups: Number(userTotalGroups),
					totalComments: Number(userTotalComments),
				};
			})
		);

		// Write notification list to file
		const notificationFile = "prisma/scripts/duplicate-user-notifications.json";
		const { writeFileSync } = await import("node:fs");
		writeFileSync(notificationFile, JSON.stringify(notifications, null, 2));
		console.log(`Notification list written to: ${notificationFile}`);
		console.log("");

		if (isDryRun) {
			console.log("DRY RUN complete. No changes made.");
			console.log("Run with --execute to apply changes.");
			return;
		}

		// Execute resolution
		console.log("Executing resolution...\n");

		for (const plan of plans) {
			console.log(`Processing ${plan.email}...`);
			await sql.begin(async (tx) => {
				await executeResolution(plan, tx);
			});
			console.log("  ✓ Done");
		}

		console.log(`\n${"=".repeat(60)}`);
		console.log("Resolution complete!");
		console.log("=".repeat(60));

		// Verify no duplicates remain
		const remainingDuplicates = await findDuplicateEmailGroups();
		if (remainingDuplicates.length > 0) {
			console.error(
				`WARNING: ${remainingDuplicates.length} duplicate groups still exist!`
			);
		} else {
			console.log("✓ No duplicate email groups remain.");
		}
	} catch (error) {
		console.error("Error:", error);
		process.exit(1);
	} finally {
		await sql.end();
	}
}

main();
