/**
 * Legacy Table Migration Script
 *
 * Migrates legacy Django tables to use UUID references instead of BigInt:
 * - api_casestudy.owner_id: bigint -> text (UUID referencing users.id)
 * - api_publishedassurancecase.assurance_case_id: bigint -> text (UUID referencing assurance_cases.id)
 *
 * Uses legacy_mappings table to convert old IDs to new UUIDs.
 *
 * Usage:
 *   pnpm exec tsx prisma/scripts/04-migrate-legacy-tables.ts [--execute]
 *
 * Without --execute, shows a dry run of what would be changed.
 * With --execute, performs the actual migration.
 */

import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	throw new Error("DATABASE_URL environment variable is not set");
}

const sql = postgres(connectionString);

type MigrationStats = {
	caseStudiesTotal: number;
	caseStudiesMigrated: number;
	caseStudiesOrphaned: number;
	publishedCasesTotal: number;
	publishedCasesMigrated: number;
	publishedCasesOrphaned: number;
};

async function checkCurrentState(): Promise<void> {
	console.log("=== CURRENT DATABASE STATE ===\n");

	// Check api_casestudy.owner_id column type
	const caseStudyColumns = await sql`
		SELECT column_name, data_type
		FROM information_schema.columns
		WHERE table_name = 'api_casestudy' AND column_name = 'owner_id'
	`;
	console.log(
		`api_casestudy.owner_id type: ${caseStudyColumns[0]?.data_type || "NOT FOUND"}`
	);

	// Check api_publishedassurancecase.assurance_case_id column type
	const publishedCaseColumns = await sql`
		SELECT column_name, data_type
		FROM information_schema.columns
		WHERE table_name = 'api_publishedassurancecase' AND column_name = 'assurance_case_id'
	`;
	console.log(
		`api_publishedassurancecase.assurance_case_id type: ${publishedCaseColumns[0]?.data_type || "NOT FOUND"}`
	);

	// Count records
	const caseStudyCount = await sql`SELECT COUNT(*) as count FROM api_casestudy`;
	const publishedCaseCount =
		await sql`SELECT COUNT(*) as count FROM api_publishedassurancecase`;

	console.log(`\napi_casestudy records: ${caseStudyCount[0].count}`);
	console.log(
		`api_publishedassurancecase records: ${publishedCaseCount[0].count}`
	);
}

async function analyzeDataForMigration(): Promise<MigrationStats> {
	console.log("\n=== DATA ANALYSIS ===\n");

	// Analyze case studies
	// Cast legacy_id to text for comparison since owner_id may already be text after initial migration
	const caseStudies = await sql`
		SELECT cs.id, cs.title, cs.owner_id,
			   lm.new_id as new_owner_id
		FROM api_casestudy cs
		LEFT JOIN legacy_mappings lm ON lm.legacy_id::text = cs.owner_id::text AND lm.entity_type = 'user'
	`;

	const caseStudiesWithMapping = caseStudies.filter((cs) => cs.new_owner_id);
	const caseStudiesOrphaned = caseStudies.filter(
		(cs) => cs.owner_id && !cs.new_owner_id
	);
	const caseStudiesNoOwner = caseStudies.filter((cs) => !cs.owner_id);

	console.log("Case Studies:");
	console.log(`  Total: ${caseStudies.length}`);
	console.log(`  With valid mapping: ${caseStudiesWithMapping.length}`);
	console.log(`  No owner (null): ${caseStudiesNoOwner.length}`);
	console.log(`  Orphaned (no mapping): ${caseStudiesOrphaned.length}`);

	if (caseStudiesOrphaned.length > 0) {
		console.log("\n  Orphaned case studies (owner_id has no mapping):");
		for (const cs of caseStudiesOrphaned.slice(0, 5)) {
			console.log(
				`    - ID ${cs.id}: "${cs.title}" (owner_id: ${cs.owner_id})`
			);
		}
		if (caseStudiesOrphaned.length > 5) {
			console.log(`    ... and ${caseStudiesOrphaned.length - 5} more`);
		}
	}

	// Analyze published cases
	// Cast legacy_id to text for comparison since assurance_case_id may already be text
	const publishedCases = await sql`
		SELECT pc.id, pc.title, pc.assurance_case_id,
			   lm.new_id as new_case_id
		FROM api_publishedassurancecase pc
		LEFT JOIN legacy_mappings lm ON lm.legacy_id::text = pc.assurance_case_id::text AND lm.entity_type = 'case'
	`;

	const publishedCasesWithMapping = publishedCases.filter(
		(pc) => pc.new_case_id
	);
	const publishedCasesOrphaned = publishedCases.filter(
		(pc) => pc.assurance_case_id && !pc.new_case_id
	);

	console.log("\nPublished Assurance Cases:");
	console.log(`  Total: ${publishedCases.length}`);
	console.log(`  With valid mapping: ${publishedCasesWithMapping.length}`);
	console.log(`  Orphaned (no mapping): ${publishedCasesOrphaned.length}`);

	if (publishedCasesOrphaned.length > 0) {
		console.log(
			"\n  Orphaned published cases (assurance_case_id has no mapping):"
		);
		for (const pc of publishedCasesOrphaned.slice(0, 5)) {
			console.log(
				`    - ID ${pc.id}: "${pc.title}" (assurance_case_id: ${pc.assurance_case_id})`
			);
		}
		if (publishedCasesOrphaned.length > 5) {
			console.log(`    ... and ${publishedCasesOrphaned.length - 5} more`);
		}
	}

	return {
		caseStudiesTotal: caseStudies.length,
		caseStudiesMigrated:
			caseStudiesWithMapping.length + caseStudiesNoOwner.length,
		caseStudiesOrphaned: caseStudiesOrphaned.length,
		publishedCasesTotal: publishedCases.length,
		publishedCasesMigrated: publishedCasesWithMapping.length,
		publishedCasesOrphaned: publishedCasesOrphaned.length,
	};
}

async function dryRun(): Promise<void> {
	console.log("=== LEGACY TABLE MIGRATION - DRY RUN ===\n");

	await checkCurrentState();
	const stats = await analyzeDataForMigration();

	console.log("\n=== MIGRATION PLAN ===\n");

	console.log("1. api_casestudy.owner_id migration:");
	console.log("   - Drop FK constraint to api_eapuser");
	console.log("   - Add new column owner_id_new (text)");
	console.log("   - Copy data using legacy_mappings (user entity_type)");
	console.log("   - Drop old column, rename new column");
	console.log("   - Add FK constraint to users table");
	console.log(`   - Records to migrate: ${stats.caseStudiesMigrated}`);
	if (stats.caseStudiesOrphaned > 0) {
		console.log(
			`   - WARNING: ${stats.caseStudiesOrphaned} records will have NULL owner_id (no mapping found)`
		);
	}

	console.log("\n2. api_publishedassurancecase.assurance_case_id migration:");
	console.log("   - Drop FK constraint to api_assurancecase");
	console.log("   - Add new column assurance_case_id_new (text)");
	console.log("   - Copy data using legacy_mappings (case entity_type)");
	console.log("   - Drop old column, rename new column");
	console.log("   - Add FK constraint to assurance_cases table");
	console.log(`   - Records to migrate: ${stats.publishedCasesMigrated}`);
	if (stats.publishedCasesOrphaned > 0) {
		console.log(
			`   - WARNING: ${stats.publishedCasesOrphaned} orphaned records will be DELETED (no mapping found)`
		);
	}

	console.log("\n=== TO EXECUTE ===");
	console.log("Run with --execute flag to perform the migration:\n");
	console.log(
		"  pnpm exec tsx prisma/scripts/04-migrate-legacy-tables.ts --execute\n"
	);
}

async function execute(): Promise<void> {
	console.log("=== LEGACY TABLE MIGRATION - EXECUTING ===\n");

	await checkCurrentState();
	const stats = await analyzeDataForMigration();

	if (stats.publishedCasesOrphaned > 0) {
		console.log(
			`\nWARNING: ${stats.publishedCasesOrphaned} orphaned published cases will be deleted.`
		);
	}

	console.log("\n=== STARTING MIGRATION ===\n");

	// Start transaction
	await sql.begin(async (tx) => {
		// =====================================================
		// STEP 1: Migrate api_casestudy.owner_id
		// =====================================================
		console.log("Step 1: Migrating api_casestudy.owner_id...");

		// Drop FK constraint
		console.log("  - Dropping FK constraint...");
		await tx`
			ALTER TABLE api_casestudy
			DROP CONSTRAINT IF EXISTS eap_api_casestudy_owner_id_32cc0f00_fk_eap_api_eapuser_id
		`;

		// Drop index
		console.log("  - Dropping index...");
		await tx`DROP INDEX IF EXISTS eap_api_casestudy_owner_id_32cc0f00`;

		// Add new column
		console.log("  - Adding new column...");
		await tx`ALTER TABLE api_casestudy ADD COLUMN owner_id_new text`;

		// Copy data using legacy mappings
		console.log("  - Copying data using legacy mappings...");
		await tx`
			UPDATE api_casestudy cs
			SET owner_id_new = lm.new_id
			FROM legacy_mappings lm
			WHERE lm.legacy_id::text = cs.owner_id::text AND lm.entity_type = 'user'
		`;

		// Drop old column and rename new
		console.log("  - Dropping old column and renaming new...");
		await tx`ALTER TABLE api_casestudy DROP COLUMN owner_id`;
		await tx`ALTER TABLE api_casestudy RENAME COLUMN owner_id_new TO owner_id`;

		// Add FK constraint to users table
		console.log("  - Adding FK constraint to users table...");
		await tx`
			ALTER TABLE api_casestudy
			ADD CONSTRAINT api_casestudy_owner_id_fkey
			FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
		`;

		// Recreate index
		console.log("  - Recreating index...");
		await tx`CREATE INDEX eap_api_casestudy_owner_id_32cc0f00 ON api_casestudy(owner_id)`;

		console.log("  DONE: api_casestudy.owner_id migrated\n");

		// =====================================================
		// STEP 2: Migrate api_publishedassurancecase.assurance_case_id
		// =====================================================
		console.log(
			"Step 2: Migrating api_publishedassurancecase.assurance_case_id..."
		);

		// First, delete orphaned records (no mapping available)
		if (stats.publishedCasesOrphaned > 0) {
			console.log(
				`  - Deleting ${stats.publishedCasesOrphaned} orphaned records...`
			);

			// Delete from junction table first
			await tx`
				DELETE FROM api_casestudy_assurance_cases
				WHERE publishedassurancecase_id IN (
					SELECT pc.id FROM api_publishedassurancecase pc
					LEFT JOIN legacy_mappings lm ON lm.legacy_id::text = pc.assurance_case_id::text AND lm.entity_type = 'case'
					WHERE lm.new_id IS NULL
				)
			`;

			// Then delete orphaned published cases
			await tx`
				DELETE FROM api_publishedassurancecase pc
				WHERE NOT EXISTS (
					SELECT 1 FROM legacy_mappings lm
					WHERE lm.legacy_id::text = pc.assurance_case_id::text AND lm.entity_type = 'case'
				)
			`;
		}

		// Drop FK constraint
		console.log("  - Dropping FK constraint...");
		await tx`
			ALTER TABLE api_publishedassurancecase
			DROP CONSTRAINT IF EXISTS eap_api_publishedass_assurance_case_id_92434322_fk_eap_api_a
		`;

		// Drop index
		console.log("  - Dropping index...");
		await tx`DROP INDEX IF EXISTS eap_api_publishedassurancecase_assurance_case_id_92434322`;

		// Add new column
		console.log("  - Adding new column...");
		await tx`ALTER TABLE api_publishedassurancecase ADD COLUMN assurance_case_id_new text`;

		// Copy data using legacy mappings
		console.log("  - Copying data using legacy mappings...");
		await tx`
			UPDATE api_publishedassurancecase pc
			SET assurance_case_id_new = lm.new_id
			FROM legacy_mappings lm
			WHERE lm.legacy_id::text = pc.assurance_case_id::text AND lm.entity_type = 'case'
		`;

		// Drop old column and rename new
		console.log("  - Dropping old column and renaming new...");
		await tx`ALTER TABLE api_publishedassurancecase DROP COLUMN assurance_case_id`;
		await tx`ALTER TABLE api_publishedassurancecase RENAME COLUMN assurance_case_id_new TO assurance_case_id`;

		// Make column NOT NULL (all records should have mappings now)
		console.log("  - Setting NOT NULL constraint...");
		await tx`ALTER TABLE api_publishedassurancecase ALTER COLUMN assurance_case_id SET NOT NULL`;

		// Add FK constraint to assurance_cases table
		console.log("  - Adding FK constraint to assurance_cases table...");
		await tx`
			ALTER TABLE api_publishedassurancecase
			ADD CONSTRAINT api_publishedassurancecase_assurance_case_id_fkey
			FOREIGN KEY (assurance_case_id) REFERENCES assurance_cases(id) ON DELETE CASCADE
		`;

		// Recreate index
		console.log("  - Recreating index...");
		await tx`CREATE INDEX eap_api_publishedassurancecase_assurance_case_id_92434322 ON api_publishedassurancecase(assurance_case_id)`;

		console.log(
			"  DONE: api_publishedassurancecase.assurance_case_id migrated\n"
		);
	});

	console.log("=== MIGRATION COMPLETE ===\n");

	// Verify final state
	await checkCurrentState();
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
