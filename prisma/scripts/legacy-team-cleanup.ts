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
 *   npx ts-node prisma/scripts/legacy-team-cleanup.ts [--execute]
 *
 * Without --execute, shows a dry run of what would be deleted.
 * With --execute, performs the actual deletion.
 */

import { PrismaClient } from "../../src/generated/prisma-new";

const prisma = new PrismaClient();

// Pattern: {username}-case-{id}-{view|edit|manage|admin}-group
const LEGACY_TEAM_PATTERN = /-case-\d+-.*-group$/;

type TeamWithRelations = {
	id: string;
	name: string;
	slug: string;
	createdAt: Date;
	members: {
		user: {
			username: string;
		};
	}[];
	casePermissions: {
		permission: string;
		case: {
			name: string;
		};
	}[];
};

async function findLegacyTeams(): Promise<TeamWithRelations[]> {
	const allTeams = await prisma.team.findMany({
		include: {
			members: {
				include: {
					user: {
						select: { username: true },
					},
				},
			},
			casePermissions: {
				include: {
					case: {
						select: { name: true },
					},
				},
			},
		},
	});

	return allTeams.filter((team) => LEGACY_TEAM_PATTERN.test(team.name));
}

async function dryRun(): Promise<void> {
	console.log("=== LEGACY TEAM CLEANUP - DRY RUN ===\n");

	const legacyTeams = await findLegacyTeams();

	if (legacyTeams.length === 0) {
		console.log("No legacy teams found. Nothing to clean up.");
		return;
	}

	console.log(`Found ${legacyTeams.length} legacy teams to delete:\n`);

	// Collect affected shares
	const affectedShares: {
		user: string;
		caseName: string;
		permission: string;
	}[] = [];

	for (const team of legacyTeams) {
		console.log(`  - ${team.name}`);

		for (const permission of team.casePermissions) {
			for (const member of team.members) {
				affectedShares.push({
					user: member.user.username,
					caseName: permission.case.name,
					permission: permission.permission,
				});
			}
		}
	}

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
			{} as Record<string, typeof affectedShares>
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
		"  npx ts-node prisma/scripts/legacy-team-cleanup.ts --execute\n"
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

	// Delete teams (cascade will handle members and permissions)
	const result = await prisma.team.deleteMany({
		where: {
			id: {
				in: teamIds,
			},
		},
	});

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
		await prisma.$disconnect();
	}
}

main();
