/**
 * Data Migration Script
 *
 * Migrates data from the legacy Django schema to the new TEA Platform schema.
 * This script should be run AFTER:
 * 1. The duplicate user resolution script (01-resolve-duplicate-users.ts)
 * 2. The new schema tables have been created (prisma migrate deploy)
 *
 * Migration order:
 * 1. Users (api_eapuser → users)
 * 2. Teams (api_eapgroup → teams, team_members)
 * 3. Cases (api_assurancecase → assurance_cases, case_permissions)
 * 4. Elements (goals, contexts, strategies, claims, evidence → assurance_elements)
 * 5. Evidence links (api_evidence_property_claim → evidence_links)
 * 6. Comments (api_comment → comments)
 *
 * Usage:
 *   pnpm exec tsx prisma/scripts/02-migrate-data.ts --dry-run
 *   pnpm exec tsx prisma/scripts/02-migrate-data.ts --execute
 */

import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	throw new Error("DATABASE_URL environment variable is not set");
}

const sql = postgres(connectionString);

// ============================================
// TYPES
// ============================================

type LegacyMapping = {
	entityType: string;
	legacyId: bigint;
	newId: string;
};

type MigrationStats = {
	users: { migrated: number; skipped: number };
	teams: { migrated: number; skipped: number };
	teamMembers: { migrated: number; skipped: number };
	cases: { migrated: number; skipped: number };
	casePermissions: { migrated: number; skipped: number };
	elements: { migrated: number; skipped: number };
	evidenceLinks: { migrated: number; skipped: number };
	comments: { migrated: number; skipped: number };
};

// ============================================
// HELPER FUNCTIONS
// ============================================

async function storeLegacyMapping(
	entityType: string,
	legacyId: bigint,
	newId: string
): Promise<void> {
	await sql`
    INSERT INTO legacy_mappings (id, entity_type, legacy_id, new_id, created_at)
    VALUES (${randomUUID()}, ${entityType}, ${legacyId}, ${newId}, NOW())
    ON CONFLICT (entity_type, legacy_id) DO NOTHING
  `;
}

async function getLegacyMapping(
	entityType: string,
	legacyId: bigint
): Promise<string | null> {
	const result = await sql`
    SELECT new_id FROM legacy_mappings
    WHERE entity_type = ${entityType} AND legacy_id = ${legacyId}
  `;
	return result.length > 0 ? result[0].new_id : null;
}

function mapAuthProvider(
	legacyProvider: string | null
): "LOCAL" | "GITHUB" | "SYSTEM" {
	if (legacyProvider === "github") {
		return "GITHUB";
	}
	return "LOCAL";
}

function generateSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.substring(0, 50);
}

// ============================================
// MIGRATION FUNCTIONS
// ============================================

async function migrateUsers(dryRun: boolean): Promise<MigrationStats["users"]> {
	console.log("\n--- Migrating Users ---");

	const oldUsers = await sql`
    SELECT
      id, username, email, password, first_name, last_name,
      auth_provider, auth_username, date_joined, last_login
    FROM api_eapuser
    ORDER BY id
  `;

	let migrated = 0;
	let skipped = 0;

	for (const user of oldUsers) {
		// Check if already migrated
		const existing = await getLegacyMapping("user", user.id);
		if (existing) {
			skipped++;
			continue;
		}

		const newId = randomUUID();
		const email =
			user.email && user.email.trim() !== ""
				? user.email
				: `legacy-${user.id}@placeholder.local`;

		if (!dryRun) {
			// Check for email collision
			const emailExists = await sql`
        SELECT id FROM users WHERE email = ${email}
      `;

			if (emailExists.length > 0) {
				console.log(
					`  Skipping user ${user.id} (${user.username}): email ${email} already exists`
				);
				skipped++;
				continue;
			}

			await sql`
        INSERT INTO users (
          id, email, username, password_hash,
          first_name, last_name,
          auth_provider, github_username, email_verified,
          default_case_mode, is_system_user,
          created_at, updated_at, last_login_at
        ) VALUES (
          ${newId}, ${email}, ${user.username}, ${user.password},
          ${user.first_name}, ${user.last_name},
          ${mapAuthProvider(user.auth_provider)}, ${user.auth_username}, ${email !== `legacy-${user.id}@placeholder.local`},
          'STANDARD', false,
          ${user.date_joined || new Date()}, NOW(), ${user.last_login}
        )
      `;

			await storeLegacyMapping("user", user.id, newId);
		}

		migrated++;
		if (migrated % 50 === 0) {
			console.log(`  Migrated ${migrated} users...`);
		}
	}

	console.log(`  Users: ${migrated} migrated, ${skipped} skipped`);
	return { migrated, skipped };
}

async function migrateTeams(dryRun: boolean): Promise<{
	teams: MigrationStats["teams"];
	teamMembers: MigrationStats["teamMembers"];
}> {
	console.log("\n--- Migrating Teams (Groups) ---");

	const oldGroups = await sql`
    SELECT id, name, owner_id, created_date
    FROM api_eapgroup
    ORDER BY id
  `;

	let teamsMigrated = 0;
	let teamsSkipped = 0;
	let membersMigrated = 0;
	let membersSkipped = 0;

	for (const group of oldGroups) {
		// Check if already migrated
		const existing = await getLegacyMapping("team", group.id);
		if (existing) {
			teamsSkipped++;
			continue;
		}

		// Get owner's new ID
		const ownerNewId = await getLegacyMapping("user", group.owner_id);
		if (!ownerNewId) {
			console.log(
				`  Skipping group ${group.id} (${group.name}): owner ${group.owner_id} not migrated`
			);
			teamsSkipped++;
			continue;
		}

		const teamId = randomUUID();
		const slug = `${generateSlug(group.name)}-${group.id}`;

		if (!dryRun) {
			await sql`
        INSERT INTO teams (
          id, name, slug, description,
          created_at, updated_at, created_by_id
        ) VALUES (
          ${teamId}, ${group.name}, ${slug}, NULL,
          ${group.created_date || new Date()}, NOW(), ${ownerNewId}
        )
      `;

			// Add owner as OWNER role
			await sql`
        INSERT INTO team_members (
          id, team_id, user_id, role, joined_at
        ) VALUES (
          ${randomUUID()}, ${teamId}, ${ownerNewId}, 'OWNER', ${group.created_date || new Date()}
        )
      `;
			membersMigrated++;

			await storeLegacyMapping("team", group.id, teamId);
		}

		teamsMigrated++;

		// Migrate team members
		const members = await sql`
      SELECT eapuser_id FROM api_eapgroup_member
      WHERE eapgroup_id = ${group.id}
    `;

		for (const member of members) {
			if (member.eapuser_id === group.owner_id) {
				continue; // Already added as owner
			}

			const memberNewId = await getLegacyMapping("user", member.eapuser_id);
			if (!memberNewId) {
				membersSkipped++;
				continue;
			}

			if (!dryRun) {
				await sql`
          INSERT INTO team_members (
            id, team_id, user_id, role, joined_at
          ) VALUES (
            ${randomUUID()}, ${teamId}, ${memberNewId}, 'MEMBER', NOW()
          )
          ON CONFLICT (team_id, user_id) DO NOTHING
        `;
			}
			membersMigrated++;
		}
	}

	console.log(`  Teams: ${teamsMigrated} migrated, ${teamsSkipped} skipped`);
	console.log(
		`  Team Members: ${membersMigrated} migrated, ${membersSkipped} skipped`
	);

	return {
		teams: { migrated: teamsMigrated, skipped: teamsSkipped },
		teamMembers: { migrated: membersMigrated, skipped: membersSkipped },
	};
}

async function migrateCases(dryRun: boolean): Promise<{
	cases: MigrationStats["cases"];
	casePermissions: MigrationStats["casePermissions"];
}> {
	console.log("\n--- Migrating Assurance Cases ---");

	const oldCases = await sql`
    SELECT
      id, name, description, owner_id, color_profile,
      lock_uuid, created_date
    FROM api_assurancecase
    ORDER BY id
  `;

	let casesMigrated = 0;
	let casesSkipped = 0;
	let permissionsMigrated = 0;
	let permissionsSkipped = 0;

	for (const oldCase of oldCases) {
		// Check if already migrated
		const existing = await getLegacyMapping("case", oldCase.id);
		if (existing) {
			casesSkipped++;
			continue;
		}

		// Get owner's new ID
		const ownerNewId = await getLegacyMapping("user", oldCase.owner_id);
		if (!ownerNewId) {
			console.log(
				`  Skipping case ${oldCase.id} (${oldCase.name}): owner ${oldCase.owner_id} not migrated`
			);
			casesSkipped++;
			continue;
		}

		const caseId = randomUUID();

		if (!dryRun) {
			await sql`
        INSERT INTO assurance_cases (
          id, name, description, created_by_id,
          mode, color_profile, lock_uuid,
          created_at, updated_at
        ) VALUES (
          ${caseId}, ${oldCase.name}, ${oldCase.description || ""}, ${ownerNewId},
          'STANDARD', ${oldCase.color_profile || "default"}, ${oldCase.lock_uuid},
          ${oldCase.created_date || new Date()}, NOW()
        )
      `;

			// Create ADMIN permission for the former owner
			await sql`
        INSERT INTO case_permissions (
          id, case_id, user_id, permission,
          granted_by_id, granted_at
        ) VALUES (
          ${randomUUID()}, ${caseId}, ${ownerNewId}, 'ADMIN',
          ${ownerNewId}, ${oldCase.created_date || new Date()}
        )
      `;
			permissionsMigrated++;

			await storeLegacyMapping("case", oldCase.id, caseId);
		}

		casesMigrated++;

		// Migrate group permissions
		// Edit groups → EDIT permission
		const editGroups = await sql`
      SELECT eapgroup_id FROM api_assurancecase_edit_groups
      WHERE assurancecase_id = ${oldCase.id}
    `;

		for (const eg of editGroups) {
			const teamNewId = await getLegacyMapping("team", eg.eapgroup_id);
			if (!teamNewId) {
				permissionsSkipped++;
				continue;
			}

			if (!dryRun) {
				await sql`
          INSERT INTO case_team_permissions (
            id, case_id, team_id, permission,
            granted_by_id, granted_at
          ) VALUES (
            ${randomUUID()}, ${caseId}, ${teamNewId}, 'EDIT',
            ${ownerNewId}, NOW()
          )
          ON CONFLICT (case_id, team_id) DO UPDATE SET permission = 'EDIT'
        `;
			}
			permissionsMigrated++;
		}

		// View groups → VIEW permission
		const viewGroups = await sql`
      SELECT eapgroup_id FROM api_assurancecase_view_groups
      WHERE assurancecase_id = ${oldCase.id}
    `;

		for (const vg of viewGroups) {
			const teamNewId = await getLegacyMapping("team", vg.eapgroup_id);
			if (!teamNewId) {
				permissionsSkipped++;
				continue;
			}

			if (!dryRun) {
				await sql`
          INSERT INTO case_team_permissions (
            id, case_id, team_id, permission,
            granted_by_id, granted_at
          ) VALUES (
            ${randomUUID()}, ${caseId}, ${teamNewId}, 'VIEW',
            ${ownerNewId}, NOW()
          )
          ON CONFLICT (case_id, team_id) DO NOTHING
        `;
			}
			permissionsMigrated++;
		}

		// Review groups → COMMENT permission
		const reviewGroups = await sql`
      SELECT eapgroup_id FROM api_assurancecase_review_groups
      WHERE assurancecase_id = ${oldCase.id}
    `;

		for (const rg of reviewGroups) {
			const teamNewId = await getLegacyMapping("team", rg.eapgroup_id);
			if (!teamNewId) {
				permissionsSkipped++;
				continue;
			}

			if (!dryRun) {
				await sql`
          INSERT INTO case_team_permissions (
            id, case_id, team_id, permission,
            granted_by_id, granted_at
          ) VALUES (
            ${randomUUID()}, ${caseId}, ${teamNewId}, 'COMMENT',
            ${ownerNewId}, NOW()
          )
          ON CONFLICT (case_id, team_id) DO NOTHING
        `;
			}
			permissionsMigrated++;
		}

		if (casesMigrated % 50 === 0) {
			console.log(`  Migrated ${casesMigrated} cases...`);
		}
	}

	console.log(`  Cases: ${casesMigrated} migrated, ${casesSkipped} skipped`);
	console.log(
		`  Permissions: ${permissionsMigrated} migrated, ${permissionsSkipped} skipped`
	);

	return {
		cases: { migrated: casesMigrated, skipped: casesSkipped },
		casePermissions: {
			migrated: permissionsMigrated,
			skipped: permissionsSkipped,
		},
	};
}

async function migrateElements(
	dryRun: boolean
): Promise<MigrationStats["elements"]> {
	console.log("\n--- Migrating Elements ---");

	let migrated = 0;
	let skipped = 0;

	// 1. Migrate Goals (top-level normative goals)
	console.log("  Migrating goals...");
	const goals = await sql`
    SELECT
      g.id, g.name, g.short_description, g.long_description,
      g.keywords, g.assurance_case_id, g.in_sandbox,
      c.created_date, c.owner_id
    FROM api_toplevelnormativegoal g
    JOIN api_assurancecase c ON g.assurance_case_id = c.id
    ORDER BY g.id
  `;

	for (const goal of goals) {
		const existing = await getLegacyMapping("goal", goal.id);
		if (existing) {
			skipped++;
			continue;
		}

		const caseNewId = await getLegacyMapping("case", goal.assurance_case_id);
		const creatorNewId = await getLegacyMapping("user", goal.owner_id);

		if (!(caseNewId && creatorNewId)) {
			skipped++;
			continue;
		}

		const elementId = randomUUID();

		if (!dryRun) {
			await sql`
        INSERT INTO assurance_elements (
          id, case_id, element_type, role,
          name, description,
          in_sandbox, from_pattern, modified_from_pattern,
          is_defeater, created_by_id,
          created_at, updated_at
        ) VALUES (
          ${elementId}, ${caseNewId}, 'GOAL', 'TOP_LEVEL',
          ${goal.name}, ${goal.short_description || ""},
          ${goal.in_sandbox}, false, false,
          false, ${creatorNewId},
          ${goal.created_date || new Date()}, NOW()
        )
      `;

			await storeLegacyMapping("goal", goal.id, elementId);
		}

		migrated++;
	}

	// 2. Migrate Contexts
	console.log("  Migrating contexts...");
	const contexts = await sql`
    SELECT
      ctx.id, ctx.name, ctx.short_description, ctx.long_description,
      ctx.goal_id, ctx.in_sandbox,
      c.created_date, c.owner_id, g.assurance_case_id
    FROM api_context ctx
    JOIN api_toplevelnormativegoal g ON ctx.goal_id = g.id
    JOIN api_assurancecase c ON g.assurance_case_id = c.id
    ORDER BY ctx.id
  `;

	for (const ctx of contexts) {
		const existing = await getLegacyMapping("context", ctx.id);
		if (existing) {
			skipped++;
			continue;
		}

		const caseNewId = await getLegacyMapping("case", ctx.assurance_case_id);
		const parentNewId = await getLegacyMapping("goal", ctx.goal_id);
		const creatorNewId = await getLegacyMapping("user", ctx.owner_id);

		if (!(caseNewId && parentNewId && creatorNewId)) {
			skipped++;
			continue;
		}

		const elementId = randomUUID();

		if (!dryRun) {
			await sql`
        INSERT INTO assurance_elements (
          id, case_id, element_type, parent_id,
          name, description,
          in_sandbox, from_pattern, modified_from_pattern,
          is_defeater, created_by_id,
          created_at, updated_at
        ) VALUES (
          ${elementId}, ${caseNewId}, 'CONTEXT', ${parentNewId},
          ${ctx.name}, ${ctx.short_description || ""},
          ${ctx.in_sandbox}, false, false,
          false, ${creatorNewId},
          ${ctx.created_date || new Date()}, NOW()
        )
      `;

			await storeLegacyMapping("context", ctx.id, elementId);
		}

		migrated++;
	}

	// 3. Migrate Strategies
	console.log("  Migrating strategies...");
	const strategies = await sql`
    SELECT
      s.id, s.name, s.short_description, s.long_description,
      s.goal_id, s.in_sandbox,
      c.created_date, c.owner_id, g.assurance_case_id
    FROM api_strategy s
    JOIN api_toplevelnormativegoal g ON s.goal_id = g.id
    JOIN api_assurancecase c ON g.assurance_case_id = c.id
    ORDER BY s.id
  `;

	for (const strat of strategies) {
		const existing = await getLegacyMapping("strategy", strat.id);
		if (existing) {
			skipped++;
			continue;
		}

		const caseNewId = await getLegacyMapping("case", strat.assurance_case_id);
		const parentNewId = await getLegacyMapping("goal", strat.goal_id);
		const creatorNewId = await getLegacyMapping("user", strat.owner_id);

		if (!(caseNewId && parentNewId && creatorNewId)) {
			skipped++;
			continue;
		}

		const elementId = randomUUID();

		if (!dryRun) {
			await sql`
        INSERT INTO assurance_elements (
          id, case_id, element_type, parent_id,
          name, description,
          in_sandbox, from_pattern, modified_from_pattern,
          is_defeater, created_by_id,
          created_at, updated_at
        ) VALUES (
          ${elementId}, ${caseNewId}, 'STRATEGY', ${parentNewId},
          ${strat.name}, ${strat.short_description || ""},
          ${strat.in_sandbox}, false, false,
          false, ${creatorNewId},
          ${strat.created_date || new Date()}, NOW()
        )
      `;

			await storeLegacyMapping("strategy", strat.id, elementId);
		}

		migrated++;
	}

	// 4. Migrate Property Claims (hierarchical)
	console.log("  Migrating property claims...");

	// First pass: claims attached to strategies (level 1)
	const level1Claims = await sql`
    SELECT
      pc.id, pc.name, pc.short_description, pc.long_description,
      pc.strategy_id, pc.goal_id, pc.property_claim_id, pc.level,
      pc.in_sandbox, c.created_date, c.owner_id, g.assurance_case_id
    FROM api_propertyclaim pc
    LEFT JOIN api_strategy s ON pc.strategy_id = s.id
    LEFT JOIN api_toplevelnormativegoal g ON (pc.goal_id = g.id OR s.goal_id = g.id)
    JOIN api_assurancecase c ON g.assurance_case_id = c.id
    WHERE pc.property_claim_id IS NULL
    ORDER BY pc.id
  `;

	for (const claim of level1Claims) {
		const existing = await getLegacyMapping("claim", claim.id);
		if (existing) {
			skipped++;
			continue;
		}

		const caseNewId = await getLegacyMapping("case", claim.assurance_case_id);
		let parentNewId: string | null = null;

		if (claim.strategy_id) {
			parentNewId = await getLegacyMapping("strategy", claim.strategy_id);
		} else if (claim.goal_id) {
			parentNewId = await getLegacyMapping("goal", claim.goal_id);
		}

		const creatorNewId = await getLegacyMapping("user", claim.owner_id);

		if (!(caseNewId && creatorNewId)) {
			skipped++;
			continue;
		}

		const elementId = randomUUID();

		if (!dryRun) {
			await sql`
        INSERT INTO assurance_elements (
          id, case_id, element_type, parent_id,
          name, description, level,
          in_sandbox, from_pattern, modified_from_pattern,
          is_defeater, created_by_id,
          created_at, updated_at
        ) VALUES (
          ${elementId}, ${caseNewId}, 'PROPERTY_CLAIM', ${parentNewId},
          ${claim.name}, ${claim.short_description || ""}, ${claim.level},
          ${claim.in_sandbox}, false, false,
          false, ${creatorNewId},
          ${claim.created_date || new Date()}, NOW()
        )
      `;

			await storeLegacyMapping("claim", claim.id, elementId);
		}

		migrated++;
	}

	// Second pass: nested claims (level 2+)
	const nestedClaims = await sql`
    SELECT
      pc.id, pc.name, pc.short_description, pc.long_description,
      pc.strategy_id, pc.goal_id, pc.property_claim_id, pc.level,
      pc.in_sandbox, c.created_date, c.owner_id
    FROM api_propertyclaim pc
    JOIN api_propertyclaim parent ON pc.property_claim_id = parent.id
    LEFT JOIN api_strategy s ON parent.strategy_id = s.id
    LEFT JOIN api_toplevelnormativegoal g ON (parent.goal_id = g.id OR s.goal_id = g.id)
    JOIN api_assurancecase c ON g.assurance_case_id = c.id
    WHERE pc.property_claim_id IS NOT NULL
    ORDER BY pc.level, pc.id
  `;

	for (const claim of nestedClaims) {
		const existing = await getLegacyMapping("claim", claim.id);
		if (existing) {
			skipped++;
			continue;
		}

		const parentNewId = await getLegacyMapping(
			"claim",
			claim.property_claim_id
		);
		const creatorNewId = await getLegacyMapping("user", claim.owner_id);

		// Get case from parent claim
		const parentElement = parentNewId
			? await sql`SELECT case_id FROM assurance_elements WHERE id = ${parentNewId}`
			: [];

		if (!(parentNewId && creatorNewId) || parentElement.length === 0) {
			skipped++;
			continue;
		}

		const caseNewId = parentElement[0].case_id;
		const elementId = randomUUID();

		if (!dryRun) {
			await sql`
        INSERT INTO assurance_elements (
          id, case_id, element_type, parent_id,
          name, description, level,
          in_sandbox, from_pattern, modified_from_pattern,
          is_defeater, created_by_id,
          created_at, updated_at
        ) VALUES (
          ${elementId}, ${caseNewId}, 'PROPERTY_CLAIM', ${parentNewId},
          ${claim.name}, ${claim.short_description || ""}, ${claim.level},
          ${claim.in_sandbox}, false, false,
          false, ${creatorNewId},
          ${claim.created_date || new Date()}, NOW()
        )
      `;

			await storeLegacyMapping("claim", claim.id, elementId);
		}

		migrated++;
	}

	// 5. Migrate Evidence
	console.log("  Migrating evidence...");
	const evidence = await sql`
    SELECT DISTINCT
      e.id, e.name, e.short_description, e.long_description,
      e."URL", e.in_sandbox, c.created_date, c.owner_id, c.id as case_id
    FROM api_evidence e
    JOIN api_evidence_property_claim epc ON e.id = epc.evidence_id
    JOIN api_propertyclaim pc ON epc.propertyclaim_id = pc.id
    LEFT JOIN api_strategy s ON pc.strategy_id = s.id
    LEFT JOIN api_toplevelnormativegoal g ON (pc.goal_id = g.id OR s.goal_id = g.id)
    JOIN api_assurancecase c ON g.assurance_case_id = c.id
    ORDER BY e.id
  `;

	for (const ev of evidence) {
		const existing = await getLegacyMapping("evidence", ev.id);
		if (existing) {
			skipped++;
			continue;
		}

		const caseNewId = await getLegacyMapping("case", ev.case_id);
		const creatorNewId = await getLegacyMapping("user", ev.owner_id);

		if (!(caseNewId && creatorNewId)) {
			skipped++;
			continue;
		}

		const elementId = randomUUID();

		if (!dryRun) {
			await sql`
        INSERT INTO assurance_elements (
          id, case_id, element_type,
          name, description, url,
          in_sandbox, from_pattern, modified_from_pattern,
          is_defeater, created_by_id,
          created_at, updated_at
        ) VALUES (
          ${elementId}, ${caseNewId}, 'EVIDENCE',
          ${ev.name}, ${ev.short_description || ""}, ${ev.URL},
          ${ev.in_sandbox}, false, false,
          false, ${creatorNewId},
          ${ev.created_date || new Date()}, NOW()
        )
      `;

			await storeLegacyMapping("evidence", ev.id, elementId);
		}

		migrated++;
	}

	console.log(`  Elements: ${migrated} migrated, ${skipped} skipped`);
	return { migrated, skipped };
}

async function migrateEvidenceLinks(
	dryRun: boolean
): Promise<MigrationStats["evidenceLinks"]> {
	console.log("\n--- Migrating Evidence Links ---");

	const links = await sql`
    SELECT evidence_id, propertyclaim_id
    FROM api_evidence_property_claim
  `;

	let migrated = 0;
	let skipped = 0;

	for (const link of links) {
		const evidenceNewId = await getLegacyMapping("evidence", link.evidence_id);
		const claimNewId = await getLegacyMapping("claim", link.propertyclaim_id);

		if (!(evidenceNewId && claimNewId)) {
			skipped++;
			continue;
		}

		if (!dryRun) {
			await sql`
        INSERT INTO evidence_links (id, evidence_id, claim_id, created_at)
        VALUES (${randomUUID()}, ${evidenceNewId}, ${claimNewId}, NOW())
        ON CONFLICT (evidence_id, claim_id) DO NOTHING
      `;
		}

		migrated++;
	}

	console.log(`  Evidence Links: ${migrated} migrated, ${skipped} skipped`);
	return { migrated, skipped };
}

async function migrateComments(
	dryRun: boolean
): Promise<MigrationStats["comments"]> {
	console.log("\n--- Migrating Comments ---");

	const oldComments = await sql`
    SELECT
      id, content, author_id, created_at,
      assurance_case_id, goal_id, context_id, strategy_id,
      property_claim_id, evidence_id
    FROM api_comment
    ORDER BY id
  `;

	let migrated = 0;
	let skipped = 0;

	for (const comment of oldComments) {
		const existing = await getLegacyMapping("comment", comment.id);
		if (existing) {
			skipped++;
			continue;
		}

		const authorNewId = await getLegacyMapping("user", comment.author_id);
		if (!authorNewId) {
			skipped++;
			continue;
		}

		// Determine what the comment is attached to
		let caseNewId: string | null = null;
		let elementNewId: string | null = null;

		if (comment.assurance_case_id) {
			caseNewId = await getLegacyMapping("case", comment.assurance_case_id);
		}

		if (comment.goal_id) {
			elementNewId = await getLegacyMapping("goal", comment.goal_id);
		} else if (comment.context_id) {
			elementNewId = await getLegacyMapping("context", comment.context_id);
		} else if (comment.strategy_id) {
			elementNewId = await getLegacyMapping("strategy", comment.strategy_id);
		} else if (comment.property_claim_id) {
			elementNewId = await getLegacyMapping("claim", comment.property_claim_id);
		} else if (comment.evidence_id) {
			elementNewId = await getLegacyMapping("evidence", comment.evidence_id);
		}

		if (!(caseNewId || elementNewId)) {
			skipped++;
			continue;
		}

		const commentId = randomUUID();

		if (!dryRun) {
			await sql`
        INSERT INTO comments (
          id, case_id, element_id, content, author_id,
          resolved, created_at, updated_at
        ) VALUES (
          ${commentId}, ${caseNewId}, ${elementNewId}, ${comment.content}, ${authorNewId},
          false, ${comment.created_at || new Date()}, NOW()
        )
      `;

			await storeLegacyMapping("comment", comment.id, commentId);
		}

		migrated++;
	}

	console.log(`  Comments: ${migrated} migrated, ${skipped} skipped`);
	return { migrated, skipped };
}

// ============================================
// MAIN
// ============================================

async function main() {
	const args = process.argv.slice(2);
	const isDryRun = args.includes("--dry-run") || !args.includes("--execute");

	console.log("=".repeat(60));
	console.log("TEA Platform: Data Migration Script");
	console.log("=".repeat(60));
	console.log(`Mode: ${isDryRun ? "DRY RUN (no changes)" : "EXECUTE"}`);

	try {
		// Check if new tables exist
		const tablesExist = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'users'
      ) as exists
    `;

		if (!tablesExist[0].exists) {
			console.error("\nError: New schema tables do not exist!");
			console.error(
				"Run 'pnpm exec prisma migrate deploy --config prisma.new.config.ts' first."
			);
			process.exit(1);
		}

		const stats: MigrationStats = {
			users: { migrated: 0, skipped: 0 },
			teams: { migrated: 0, skipped: 0 },
			teamMembers: { migrated: 0, skipped: 0 },
			cases: { migrated: 0, skipped: 0 },
			casePermissions: { migrated: 0, skipped: 0 },
			elements: { migrated: 0, skipped: 0 },
			evidenceLinks: { migrated: 0, skipped: 0 },
			comments: { migrated: 0, skipped: 0 },
		};

		// Run migrations in order
		stats.users = await migrateUsers(isDryRun);

		const teamResults = await migrateTeams(isDryRun);
		stats.teams = teamResults.teams;
		stats.teamMembers = teamResults.teamMembers;

		const caseResults = await migrateCases(isDryRun);
		stats.cases = caseResults.cases;
		stats.casePermissions = caseResults.casePermissions;

		stats.elements = await migrateElements(isDryRun);
		stats.evidenceLinks = await migrateEvidenceLinks(isDryRun);
		stats.comments = await migrateComments(isDryRun);

		// Summary
		console.log(`\n${"=".repeat(60)}`);
		console.log("MIGRATION SUMMARY");
		console.log("=".repeat(60));
		console.table(stats);

		if (isDryRun) {
			console.log("\nDRY RUN complete. No changes made.");
			console.log("Run with --execute to apply changes.");
		} else {
			console.log("\nMigration complete!");
		}
	} catch (error) {
		console.error("\nError:", error);
		process.exit(1);
	} finally {
		await sql.end();
	}
}

main();
