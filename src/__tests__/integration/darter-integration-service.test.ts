import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import {
	DARTER_EXPECTED_SCOPES,
	DARTER_INTEGRATION_NAME,
	ensureDarterCaseGrant,
	ensureDarterIntegration,
} from "@/lib/services/darter-integration-service";
import { expectSuccess } from "../utils/assertion-helpers";
import { createTestCase, createTestUser } from "../utils/prisma-factories";

/**
 * `ensureDarterIntegration` / `ensureDarterCaseGrant` are the shared
 * find-or-register-and-grant logic behind two callers that must stay in
 * lockstep on name/scopes — `scripts/seed-darter-integration.ts` and the
 * demo-seed path (`prisma/seed/dev-seed.ts`) — see the module doc comment on
 * `lib/services/darter-integration-service.ts`. Neither caller, nor
 * `machine-auth.test.ts` (which tests `integration-registry-service.ts`
 * directly, not this wrapper), exercises the `"reconciled"` branch: nothing
 * mutates a persisted integration's scopes out from under the service to
 * force drift detection on a re-run. This file closes that gap.
 */
describe("ensureDarterIntegration", () => {
	it("creates the integration on first call — status 'created', scopes match DARTER_EXPECTED_SCOPES", async () => {
		const actor = await createTestUser();

		const result = expectSuccess(await ensureDarterIntegration(actor.id));

		expect(result.status).toBe("created");
		const persisted = await prisma.integration.findUniqueOrThrow({
			where: { id: result.integrationId },
		});
		expect(persisted.name).toBe(DARTER_INTEGRATION_NAME);
		expect(persisted.scopes).toEqual([...DARTER_EXPECTED_SCOPES]);
		expect(persisted.systemUserId).toBe(result.systemUserId);
	});

	it("returns 'existing' on a second call by the same actor — no duplicate integration row, scopes unchanged", async () => {
		const actor = await createTestUser();

		const first = expectSuccess(await ensureDarterIntegration(actor.id));
		const second = expectSuccess(await ensureDarterIntegration(actor.id));

		expect(second.status).toBe("existing");
		expect(second.integrationId).toBe(first.integrationId);
		expect(second.systemUserId).toBe(first.systemUserId);

		const rows = await prisma.integration.findMany({
			where: { name: DARTER_INTEGRATION_NAME },
		});
		expect(rows).toHaveLength(1);
		const persisted = await prisma.integration.findUniqueOrThrow({
			where: { name: DARTER_INTEGRATION_NAME },
		});
		expect(persisted.scopes).toEqual([...DARTER_EXPECTED_SCOPES]);
	});

	it("reconciles drifted scopes back to DARTER_EXPECTED_SCOPES — status 'reconciled'", async () => {
		const actor = await createTestUser();
		const created = expectSuccess(await ensureDarterIntegration(actor.id));

		// Simulate drift directly against the DB, bypassing the service — the
		// way a manual hotfix, a bad migration, or a bug elsewhere might leave
		// the persisted scopes out of sync with DARTER_EXPECTED_SCOPES.
		await prisma.integration.update({
			where: { id: created.integrationId },
			data: { scopes: ["case:read"] },
		});

		const reconciled = expectSuccess(await ensureDarterIntegration(actor.id));

		expect(reconciled.status).toBe("reconciled");
		expect(reconciled.integrationId).toBe(created.integrationId);
		expect(reconciled.systemUserId).toBe(created.systemUserId);

		const persisted = await prisma.integration.findUniqueOrThrow({
			where: { id: created.integrationId },
		});
		expect(persisted.scopes).toEqual([...DARTER_EXPECTED_SCOPES]);

		// Reconciliation must update the existing row, never create a second one.
		const rows = await prisma.integration.findMany({
			where: { name: DARTER_INTEGRATION_NAME },
		});
		expect(rows).toHaveLength(1);
	});
});

describe("ensureDarterCaseGrant", () => {
	it("upserts the case permission grant — a second call with a different permission value updates it to the latest, not a second row", async () => {
		const actor = await createTestUser();
		const testCase = await createTestCase(actor.id);
		const { systemUserId } = expectSuccess(
			await ensureDarterIntegration(actor.id)
		);

		await ensureDarterCaseGrant(testCase.id, systemUserId, "VIEW", actor.id);
		await ensureDarterCaseGrant(testCase.id, systemUserId, "EDIT", actor.id);

		const grant = await prisma.casePermission.findUniqueOrThrow({
			where: {
				caseId_userId: { caseId: testCase.id, userId: systemUserId },
			},
		});
		expect(grant.permission).toBe("EDIT");
		expect(grant.grantedById).toBe(actor.id);

		const grants = await prisma.casePermission.findMany({
			where: { caseId: testCase.id, userId: systemUserId },
		});
		expect(grants).toHaveLength(1);
	});
});
