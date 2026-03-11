import { Pool } from "pg";
import { afterAll, afterEach } from "vitest";

// Create a dedicated pool for cleanup (NOT through Prisma)
const cleanupPool = new Pool({
	connectionString: process.env.DATABASE_URL,
	max: 1,
});

// Truncate all tables after each test
afterEach(async () => {
	const client = await cleanupPool.connect();
	try {
		// Truncate all application tables in one statement with CASCADE
		await client.query(`
      TRUNCATE TABLE
        case_study_images,
        case_study_published_cases,
        published_assurance_cases,
        case_studies,
        release_images,
        release_comments,
        release_snapshots,
        releases,
        comments,
        evidence_links,
        case_images,
        case_type_assignments,
        case_types,
        case_invites,
        case_team_permissions,
        case_permissions,
        assurance_elements,
        assurance_cases,
        pattern_permissions,
        pattern_team_permissions,
        pattern_elements,
        argument_patterns,
        team_members,
        teams,
        github_repositories,
        rate_limit_attempts,
        security_audit_logs,
        password_reset_attempts,
        users
      CASCADE
    `);
	} finally {
		client.release();
	}
});

// Cleanup pool on process exit
afterAll(async () => {
	await cleanupPool.end();
});
