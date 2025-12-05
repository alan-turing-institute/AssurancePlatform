/**
 * Legacy Team Cleanup Script
 *
 * Removes auto-generated Django permission groups that follow the pattern:
 * {username}-case-{id}-{permission}-group
 *
 * These were created by the old Django backend for per-case sharing and are
 * no longer needed with the new team-based permission system.
 *
 * Usage:
 *   pnpm exec tsx prisma/scripts/legacy-team-cleanup.ts [--execute]
 *
 * Without --execute, shows a dry run of what would be deleted.
 * With --execute, performs the actual deletion.
 */

import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	throw new Error("DATABASE_URL environment variable is not set");
}

const sql = postgres(connectionString);

// Pattern: {username}-case-{id}-{view|edit|manage|admin}-group
const LEGACY_TEAM_PATTERN = /-case-\d+-.*-group$/;

type LegacyTeam = {
	id: string;
	name: string;
};

type AffectedShare = {
	user: string;
	caseName: string;
	permission: string;
};

async function findLegacyTeams(): Promise<LegacyTeam[]> {
	const allTeams = await sql<LegacyTeam[]>`
		SELECT id, name FROM teams ORDER BY name
	`;

	return allTeams.filter((team) => LEGACY_TEAM_PATTERN.test(team.name));
}

async function getAffectedShares(teamIds: string[]): Promise<AffectedShare[]> {
	if (teamIds.length === 0) {
		return [];
	}

	const shares = await sql<AffectedShare[]>`
		SELECT
			u.username as user,
			ac.name as "caseName",
			ctp.permission
		FROM case_team_permissions ctp
		JOIN teams t ON t.id = ctp.team_id
		JOIN team_members tm ON tm.team_id = t.id
		JOIN users u ON u.id = tm.user_id
		JOIN assurance_cases ac ON ac.id = ctp.case_id
		WHERE t.id = ANY(${teamIds})
	`;

	return shares;
}

async function dryRun(): Promise<void> {
	console.log("=== LEGACY TEAM CLEANUP - DRY RUN ===\n");

	const legacyTeams = await findLegacyTeams();

	if (legacyTeams.length === 0) {
		console.log("No legacy teams found. Nothing to clean up.");
		return;
	}

	console.log(`Found ${legacyTeams.length} legacy teams to delete:\n`);

	for (const team of legacyTeams) {
		console.log(`  - ${team.name}`);
	}

	const teamIds = legacyTeams.map((t) => t.id);
	const affectedShares = await getAffectedShares(teamIds);

	if (affectedShares.length > 0) {
		console.log("\n=== AFFECTED SHARES ===\n");
		console.log("The following users will lose access to these cases:\n");

		const uniqueUsers = [...new Set(affectedShares.map((s) => s.user))];
		console.log(`Affected users: ${uniqueUsers.join(", ")}\n`);

		// Group by user
		const byUser = affectedShares.reduce(
			(acc, share) => {
				if (!acc[share.user]) {
					acc[share.user] = [];
				}
				acc[share.user].push(share);
				return acc;
			},
			{} as Record<string, AffectedShare[]>
		);

		for (const [user, shares] of Object.entries(byUser)) {
			console.log(`  ${user}:`);
			for (const share of shares) {
				console.log(`    - ${share.caseName} (${share.permission})`);
			}
		}
	} else {
		console.log("\nNo active shares will be affected.");
	}

	console.log("\n=== TO EXECUTE ===");
	console.log("Run with --execute flag to perform the deletion:\n");
	console.log(
		"  pnpm exec tsx prisma/scripts/legacy-team-cleanup.ts --execute\n"
	);
}

async function execute(): Promise<void> {
	console.log("=== LEGACY TEAM CLEANUP - EXECUTING ===\n");

	const legacyTeams = await findLegacyTeams();

	if (legacyTeams.length === 0) {
		console.log("No legacy teams found. Nothing to clean up.");
		return;
	}

	console.log(`Deleting ${legacyTeams.length} legacy teams...\n`);

	const teamIds = legacyTeams.map((t) => t.id);

	// Delete teams (cascade will handle members and permissions via FK constraints)
	const result = await sql`
		DELETE FROM teams WHERE id = ANY(${teamIds})
	`;

	console.log(`Deleted ${result.count} teams.`);
	console.log("\nCleanup complete.");
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const shouldExecute = args.includes("--execute");

	try {
		if (shouldExecute) {
			await execute();
		} else {
			await dryRun();
		}
	} catch (error) {
		console.error("Error:", error);
		process.exit(1);
	} finally {
		await sql.end();
	}
}

main();
