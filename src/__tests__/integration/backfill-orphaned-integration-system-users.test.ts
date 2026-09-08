import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { registerIntegration } from "@/lib/services/integration-registry-service";
import { createTestUser } from "../utils/prisma-factories";

/**
 * Pins the hand-written data migration
 * `prisma/migrations/20260714000000_backfill_delete_orphaned_integration_system_users/migration.sql`
 * (TEA — Integration delete leaves the machine user behind; QA proved live
 * on staging that a system user orphaned by the OLD `deleteIntegrationRegistration`
 * bug — before it deleted the system user alongside the `Integration` row —
 * still blocks same-name re-registration today: `integration-darter-pipeline`).
 * The service-level fix only stops NEW orphans; this migration cleans up
 * ones the old code already left behind.
 *
 * Reads and executes the migration file's ACTUAL SQL (not a hand-copied
 * predicate that could drift from what `prisma migrate deploy` really
 * applies) via `$executeRawUnsafe`, against rows set up with `prisma`
 * directly — this is data cleanup, not something exercised by any API
 * route, so there is no route/service call that goes through it.
 */
const MIGRATION_SQL = readFileSync(
	path.join(
		import.meta.dirname,
		"../../../prisma/migrations/20260714000000_backfill_delete_orphaned_integration_system_users/migration.sql"
	),
	"utf8"
);

const INTEGRATION_USERNAME_PATTERN = /^integration-/;
const INTEGRATION_EMAIL_PATTERN = /^integration\+.*@tea-platform\.internal$/;

async function runBackfillMigration(): Promise<void> {
	// The migration file is exactly one statement (with leading `--`
	// comments) — sent verbatim, the same text `prisma migrate deploy` would
	// apply. Naively splitting on `;` first is NOT safe here: several of the
	// comment lines above the statement themselves contain `;` in prose
	// (e.g. "already excludes it; it is also never referenced by"), so a
	// blind split produces a fragment that doesn't start with `--` and gets
	// sent as if it were SQL.
	await prisma.$executeRawUnsafe(MIGRATION_SQL);
}

describe("backfill: delete orphaned integration system users", () => {
	it("deletes an orphan-shaped system user with no referencing Integration, and a same-name registration then succeeds", async () => {
		const owner = await createTestUser();
		const slug = "orphan-backfill-test";

		const orphan = await prisma.user.create({
			data: {
				email: `integration+${slug}@tea-platform.internal`,
				username: `integration-${slug}`,
				isSystemUser: true,
				authProvider: "SYSTEM",
				emailVerified: true,
			},
		});
		// No `Integration` row references this user — exactly the shape the OLD
		// bug left behind.
		expect(
			await prisma.integration.findFirst({
				where: { systemUserId: orphan.id },
			})
		).toBeNull();

		await runBackfillMigration();

		expect(
			await prisma.user.findUnique({ where: { id: orphan.id } })
		).toBeNull();

		// Re-registering under the name the orphan's username/email were
		// derived from now succeeds instead of colliding on the orphan's
		// leftover unique username/email.
		const registerResult = await registerIntegration(
			{ name: slug, scopes: ["case:read"] },
			owner.id
		);
		expect("data" in registerResult).toBe(true);
		if ("data" in registerResult) {
			expect(registerResult.data.integration.name).toBe(slug);
		}
	});

	it("does NOT delete the generic fallback system account (`getOrCreateSystemUser`'s shape)", async () => {
		// Mirrors `getOrCreateSystemUser`'s own fixed literals
		// (`lib/services/user-management-service.ts`, ~line 290) — a
		// deliberately separate account from any integration's system user.
		// Its username/email shape does not match `integration-%` /
		// `integration+%@tea-platform.internal`, so it must survive the
		// backfill by construction, not by coincidence.
		const genericSystemAccount = await prisma.user.upsert({
			where: { email: "system@tea-platform.internal" },
			create: {
				email: "system@tea-platform.internal",
				username: "system",
				isSystemUser: true,
				authProvider: "SYSTEM",
				emailVerified: true,
			},
			update: {},
		});
		expect(genericSystemAccount.username).not.toMatch(
			INTEGRATION_USERNAME_PATTERN
		);
		expect(genericSystemAccount.email).not.toMatch(INTEGRATION_EMAIL_PATTERN);

		await runBackfillMigration();

		expect(
			await prisma.user.findUnique({ where: { id: genericSystemAccount.id } })
		).not.toBeNull();
	});

	it("does NOT delete a LIVE integration's system user, even though its username/email match the integration-shape", async () => {
		const owner = await createTestUser();
		const name = "backfill-live-integration";
		const registerResult = await registerIntegration(
			{ name, scopes: ["case:read"] },
			owner.id
		);
		expect("data" in registerResult).toBe(true);
		if (!("data" in registerResult)) {
			throw new Error("expected registerIntegration to succeed");
		}
		const { integration, systemUserId } = registerResult.data;

		// Confirm this system user genuinely matches the integration-shape the
		// migration's predicate targets — it is protected by the
		// no-referencing-Integration condition, not by falling outside the
		// shape entirely.
		const liveSystemUserBefore = await prisma.user.findUniqueOrThrow({
			where: { id: systemUserId },
		});
		expect(liveSystemUserBefore.username).toMatch(INTEGRATION_USERNAME_PATTERN);
		expect(liveSystemUserBefore.email).toMatch(INTEGRATION_EMAIL_PATTERN);

		await runBackfillMigration();

		expect(
			await prisma.user.findUnique({ where: { id: systemUserId } })
		).not.toBeNull();
		expect(
			await prisma.integration.findUnique({ where: { id: integration.id } })
		).not.toBeNull();
	});
});
