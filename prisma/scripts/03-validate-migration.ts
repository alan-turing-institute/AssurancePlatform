/**
 * Migration Validation Script
 *
 * Validates that data was migrated correctly from Django to the new schema.
 * Run this AFTER the data migration script (02-migrate-data.ts).
 *
 * Checks:
 * 1. Entity counts match (users, teams, cases, elements, comments)
 * 2. Every case has at least one ADMIN permission
 * 3. All relationships are valid (no orphaned records)
 * 4. Data integrity (required fields populated)
 *
 * Usage:
 *   pnpm exec tsx prisma/scripts/03-validate-migration.ts
 */

import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	throw new Error("DATABASE_URL environment variable is not set");
}

const sql = postgres(connectionString);

type ValidationResult = {
	check: string;
	passed: boolean;
	details: string;
};

// ============================================
// VALIDATION FUNCTIONS
// ============================================

async function validateUserCounts(): Promise<ValidationResult> {
	const oldCount = await sql`SELECT COUNT(*) as count FROM api_eapuser`;
	const newCount = await sql`SELECT COUNT(*) as count FROM users`;
	const mappingCount = await sql`
    SELECT COUNT(*) as count FROM legacy_mappings WHERE entity_type = 'user'
  `;

	const oldNum = Number(oldCount[0].count);
	const newNum = Number(newCount[0].count);
	const mappingNum = Number(mappingCount[0].count);

	// Note: counts may not match exactly if duplicates were resolved
	const passed = newNum > 0 && mappingNum === newNum;

	return {
		check: "User counts",
		passed,
		details: `Old: ${oldNum}, New: ${newNum}, Mappings: ${mappingNum}`,
	};
}

async function validateTeamCounts(): Promise<ValidationResult> {
	const oldCount = await sql`SELECT COUNT(*) as count FROM api_eapgroup`;
	const newCount = await sql`SELECT COUNT(*) as count FROM teams`;
	const mappingCount = await sql`
    SELECT COUNT(*) as count FROM legacy_mappings WHERE entity_type = 'team'
  `;

	const oldNum = Number(oldCount[0].count);
	const newNum = Number(newCount[0].count);
	const mappingNum = Number(mappingCount[0].count);

	const passed = oldNum === newNum && mappingNum === newNum;

	return {
		check: "Team counts",
		passed,
		details: `Old: ${oldNum}, New: ${newNum}, Mappings: ${mappingNum}`,
	};
}

async function validateCaseCounts(): Promise<ValidationResult> {
	const oldCount = await sql`SELECT COUNT(*) as count FROM api_assurancecase`;
	const newCount = await sql`SELECT COUNT(*) as count FROM assurance_cases`;
	const mappingCount = await sql`
    SELECT COUNT(*) as count FROM legacy_mappings WHERE entity_type = 'case'
  `;

	const oldNum = Number(oldCount[0].count);
	const newNum = Number(newCount[0].count);
	const mappingNum = Number(mappingCount[0].count);

	const passed = oldNum === newNum && mappingNum === newNum;

	return {
		check: "Case counts",
		passed,
		details: `Old: ${oldNum}, New: ${newNum}, Mappings: ${mappingNum}`,
	};
}

async function validateElementCounts(): Promise<ValidationResult> {
	// Count old elements (goals + contexts + strategies + claims + evidence)
	const oldGoals =
		await sql`SELECT COUNT(*) as count FROM api_toplevelnormativegoal`;
	const oldContexts = await sql`SELECT COUNT(*) as count FROM api_context`;
	const oldStrategies = await sql`SELECT COUNT(*) as count FROM api_strategy`;
	const oldClaims = await sql`SELECT COUNT(*) as count FROM api_propertyclaim`;
	const oldEvidence = await sql`SELECT COUNT(*) as count FROM api_evidence`;

	const oldTotal =
		Number(oldGoals[0].count) +
		Number(oldContexts[0].count) +
		Number(oldStrategies[0].count) +
		Number(oldClaims[0].count) +
		Number(oldEvidence[0].count);

	const newCount = await sql`SELECT COUNT(*) as count FROM assurance_elements`;
	const newNum = Number(newCount[0].count);

	// Get counts by type
	const newByType = await sql`
    SELECT element_type, COUNT(*) as count
    FROM assurance_elements
    GROUP BY element_type
  `;

	const typeDetails = newByType
		.map((r) => `${r.element_type}: ${r.count}`)
		.join(", ");

	// Allow some variance due to orphaned records
	const passed = newNum > 0 && newNum >= oldTotal * 0.9;

	return {
		check: "Element counts",
		passed,
		details: `Old total: ${oldTotal} (G:${oldGoals[0].count} C:${oldContexts[0].count} S:${oldStrategies[0].count} P:${oldClaims[0].count} E:${oldEvidence[0].count}), New: ${newNum} (${typeDetails})`,
	};
}

async function validateCaseAdmins(): Promise<ValidationResult> {
	// Every case must have at least one ADMIN permission
	const casesWithoutAdmin = await sql`
    SELECT ac.id, ac.name
    FROM assurance_cases ac
    LEFT JOIN case_permissions cp ON ac.id = cp.case_id AND cp.permission = 'ADMIN'
    WHERE cp.id IS NULL
  `;

	const passed = casesWithoutAdmin.length === 0;

	return {
		check: "Cases have ADMIN",
		passed,
		details: passed
			? "All cases have at least one admin"
			: `${casesWithoutAdmin.length} cases without admin: ${casesWithoutAdmin
					.slice(0, 3)
					.map((c) => c.name)
					.join(", ")}...`,
	};
}

async function validateUserRelationships(): Promise<ValidationResult> {
	// Check for orphaned case permissions (user doesn't exist)
	const orphanedPermissions = await sql`
    SELECT cp.id
    FROM case_permissions cp
    LEFT JOIN users u ON cp.user_id = u.id
    WHERE u.id IS NULL
  `;

	// Check for orphaned team members
	const orphanedMembers = await sql`
    SELECT tm.id
    FROM team_members tm
    LEFT JOIN users u ON tm.user_id = u.id
    WHERE u.id IS NULL
  `;

	const passed =
		orphanedPermissions.length === 0 && orphanedMembers.length === 0;

	return {
		check: "User relationships",
		passed,
		details: `Orphaned permissions: ${orphanedPermissions.length}, Orphaned team members: ${orphanedMembers.length}`,
	};
}

async function validateElementRelationships(): Promise<ValidationResult> {
	// Check for elements with invalid case references
	const orphanedElements = await sql`
    SELECT ae.id
    FROM assurance_elements ae
    LEFT JOIN assurance_cases ac ON ae.case_id = ac.id
    WHERE ac.id IS NULL
  `;

	// Check for elements with invalid parent references
	const invalidParents = await sql`
    SELECT ae.id
    FROM assurance_elements ae
    LEFT JOIN assurance_elements parent ON ae.parent_id = parent.id
    WHERE ae.parent_id IS NOT NULL AND parent.id IS NULL
  `;

	const passed = orphanedElements.length === 0 && invalidParents.length === 0;

	return {
		check: "Element relationships",
		passed,
		details: `Orphaned elements: ${orphanedElements.length}, Invalid parents: ${invalidParents.length}`,
	};
}

async function validateEvidenceLinks(): Promise<ValidationResult> {
	const oldCount =
		await sql`SELECT COUNT(*) as count FROM api_evidence_property_claim`;
	const newCount = await sql`SELECT COUNT(*) as count FROM evidence_links`;

	const oldNum = Number(oldCount[0].count);
	const newNum = Number(newCount[0].count);

	// Check for invalid links
	const invalidLinks = await sql`
    SELECT el.id
    FROM evidence_links el
    LEFT JOIN assurance_elements e ON el.evidence_id = e.id
    LEFT JOIN assurance_elements c ON el.claim_id = c.id
    WHERE e.id IS NULL OR c.id IS NULL
  `;

	const passed = invalidLinks.length === 0 && newNum >= oldNum * 0.9;

	return {
		check: "Evidence links",
		passed,
		details: `Old: ${oldNum}, New: ${newNum}, Invalid: ${invalidLinks.length}`,
	};
}

async function validateRequiredFields(): Promise<ValidationResult> {
	// Check users have email
	const usersWithoutEmail = await sql`
    SELECT COUNT(*) as count FROM users WHERE email IS NULL OR email = ''
  `;

	// Check cases have name
	const casesWithoutName = await sql`
    SELECT COUNT(*) as count FROM assurance_cases WHERE name IS NULL OR name = ''
  `;

	// Check elements have description
	const elementsWithoutDesc = await sql`
    SELECT COUNT(*) as count FROM assurance_elements WHERE description IS NULL
  `;

	const issues = [];
	if (Number(usersWithoutEmail[0].count) > 0) {
		issues.push(`${usersWithoutEmail[0].count} users without email`);
	}
	if (Number(casesWithoutName[0].count) > 0) {
		issues.push(`${casesWithoutName[0].count} cases without name`);
	}
	if (Number(elementsWithoutDesc[0].count) > 0) {
		issues.push(`${elementsWithoutDesc[0].count} elements without description`);
	}

	const passed = issues.length === 0;

	return {
		check: "Required fields",
		passed,
		details: passed ? "All required fields populated" : issues.join(", "),
	};
}

async function validateComments(): Promise<ValidationResult> {
	const oldCount = await sql`SELECT COUNT(*) as count FROM api_comment`;
	const newCount = await sql`SELECT COUNT(*) as count FROM comments`;

	const oldNum = Number(oldCount[0].count);
	const newNum = Number(newCount[0].count);

	// Check for orphaned comments
	const orphanedComments = await sql`
    SELECT c.id
    FROM comments c
    LEFT JOIN users u ON c.author_id = u.id
    WHERE u.id IS NULL
  `;

	const passed = orphanedComments.length === 0 && newNum >= oldNum * 0.9;

	return {
		check: "Comments",
		passed,
		details: `Old: ${oldNum}, New: ${newNum}, Orphaned: ${orphanedComments.length}`,
	};
}

// ============================================
// MAIN
// ============================================

async function main() {
	console.log("=".repeat(60));
	console.log("TEA Platform: Migration Validation");
	console.log("=".repeat(60));
	console.log("");

	try {
		// Check if new tables exist
		const tablesExist = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'users'
      ) as exists
    `;

		if (!tablesExist[0].exists) {
			console.error("Error: New schema tables do not exist!");
			console.error("Run the migration first.");
			process.exit(1);
		}

		const results: ValidationResult[] = [];

		// Run all validations
		console.log("Running validations...\n");

		results.push(await validateUserCounts());
		results.push(await validateTeamCounts());
		results.push(await validateCaseCounts());
		results.push(await validateElementCounts());
		results.push(await validateCaseAdmins());
		results.push(await validateUserRelationships());
		results.push(await validateElementRelationships());
		results.push(await validateEvidenceLinks());
		results.push(await validateRequiredFields());
		results.push(await validateComments());

		// Display results
		console.log("VALIDATION RESULTS");
		console.log("-".repeat(60));

		for (const result of results) {
			const status = result.passed ? "PASS" : "FAIL";
			const icon = result.passed ? "✓" : "✗";
			console.log(`${icon} [${status}] ${result.check}`);
			console.log(`         ${result.details}`);
			console.log("");
		}

		// Summary
		const passedCount = results.filter((r) => r.passed).length;
		const failedCount = results.filter((r) => !r.passed).length;

		console.log("=".repeat(60));
		console.log(`SUMMARY: ${passedCount} passed, ${failedCount} failed`);
		console.log("=".repeat(60));

		if (failedCount > 0) {
			console.log("\nValidation FAILED. Please review the issues above.");
			process.exit(1);
		} else {
			console.log("\nValidation PASSED. Migration successful!");
		}
	} catch (error) {
		console.error("Error:", error);
		process.exit(1);
	} finally {
		await sql.end();
	}
}

main();
