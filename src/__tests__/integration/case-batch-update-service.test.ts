import { describe, expect, it, vi } from "vitest";
import type { ElementChange } from "@/lib/case/tree-diff";
import prisma from "@/lib/prisma";
import {
	expectError,
	expectSameError,
	expectSuccess,
} from "../utils/assertion-helpers";
import {
	createTestCase,
	createTestElement,
	createTestIntegrationWithSystemUser,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * SSE broadcasts are fire-and-forget in-process operations with no external I/O.
 * Mock to prevent test blocking on real SSE setup — not to avoid real DB testing.
 */
vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));

const ASSERTION_STATUS_PERMISSION_DENIED_PATTERN =
	/Permission denied.*assertionStatus/;
const AS_CITED_PATTERN = /AS_CITED/;

// ============================================
// applyBatchUpdate
// ============================================

describe("applyBatchUpdate", () => {
	it("creates elements via a batch update", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		const newId = `element-create-${Date.now()}`;
		const changes: ElementChange[] = [
			{
				type: "create",
				elementId: newId,
				parentId: null,
				data: {
					id: newId,
					type: "GOAL",
					name: "New Goal",
					description: "A goal created via batch",
					inSandbox: false,
					role: "TOP_LEVEL",
				},
			},
		];

		const data = expectSuccess(
			await applyBatchUpdate(user.id, testCase.id, changes)
		);
		expect(data.summary.created).toBe(1);
		expect(data.summary.updated).toBe(0);
		expect(data.summary.deleted).toBe(0);

		const created = await prisma.assuranceElement.findUnique({
			where: { id: newId },
		});
		expect(created).not.toBeNull();
		expect(created?.name).toBe("New Goal");
	});

	it("updates elements via a batch update", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);
		const element = await createTestElement(testCase.id, user.id, {
			elementType: "GOAL",
			name: "Original Name",
			description: "Original description",
		});

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		const changes: ElementChange[] = [
			{
				type: "update",
				elementId: element.id,
				data: { name: "Updated Name" },
			},
		];

		const data = expectSuccess(
			await applyBatchUpdate(user.id, testCase.id, changes)
		);
		expect(data.summary.updated).toBe(1);

		const updated = await prisma.assuranceElement.findUnique({
			where: { id: element.id },
		});
		expect(updated?.name).toBe("Updated Name");
	});

	it("deletes elements via a batch update", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);
		const element = await createTestElement(testCase.id, user.id, {
			elementType: "GOAL",
			name: "To Be Deleted",
			description: "Will be removed",
		});

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		const changes: ElementChange[] = [
			{
				type: "delete",
				elementId: element.id,
			},
		];

		const data = expectSuccess(
			await applyBatchUpdate(user.id, testCase.id, changes)
		);
		expect(data.summary.deleted).toBe(1);

		const found = await prisma.assuranceElement.findUnique({
			where: { id: element.id },
		});
		expect(found).toBeNull();
	});

	it("handles a mixed batch of create, update, and delete in a single call", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);

		// Existing element to update
		const toUpdate = await createTestElement(testCase.id, user.id, {
			elementType: "GOAL",
			name: "Update Me",
			description: "Will be updated",
		});

		// Existing element to delete
		const toDelete = await createTestElement(testCase.id, user.id, {
			elementType: "STRATEGY",
			name: "Delete Me",
			description: "Will be removed",
			parentId: toUpdate.id,
		});

		const newId = `element-mixed-${Date.now()}`;

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		const changes: ElementChange[] = [
			{
				type: "create",
				elementId: newId,
				parentId: null,
				data: {
					id: newId,
					type: "GOAL",
					name: "Brand New Goal",
					description: "Created in mixed batch",
					inSandbox: false,
					role: "TOP_LEVEL",
				},
			},
			{
				type: "update",
				elementId: toUpdate.id,
				data: { name: "Now Updated" },
			},
			{
				type: "delete",
				elementId: toDelete.id,
			},
		];

		const data = expectSuccess(
			await applyBatchUpdate(user.id, testCase.id, changes)
		);
		expect(data.summary.created).toBe(1);
		expect(data.summary.updated).toBe(1);
		expect(data.summary.deleted).toBe(1);

		// Verify DB state
		const created = await prisma.assuranceElement.findUnique({
			where: { id: newId },
		});
		expect(created?.name).toBe("Brand New Goal");

		const updated = await prisma.assuranceElement.findUnique({
			where: { id: toUpdate.id },
		});
		expect(updated?.name).toBe("Now Updated");

		const deleted = await prisma.assuranceElement.findUnique({
			where: { id: toDelete.id },
		});
		expect(deleted).toBeNull();
	});

	it("returns a permission denied error when user has no EDIT access", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const testCase = await createTestCase(owner.id);

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		expectError(
			await applyBatchUpdate(stranger.id, testCase.id, []),
			"Permission denied"
		);
	});

	it("returns a permission denied error for a user with only VIEW access", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		expectError(
			await applyBatchUpdate(viewer.id, testCase.id, []),
			"Permission denied"
		);
	});

	it("returns a permission denied error for a non-existent case", async () => {
		const user = await createTestUser();

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		// Same error as no-permission — prevents enumeration
		expectError(
			await applyBatchUpdate(user.id, "non-existent-case-id", []),
			"Permission denied"
		);
	});

	it("returns same error for not-found and no-access (anti-enumeration)", async () => {
		const owner = await createTestUser();
		const otherUser = await createTestUser();
		const testCase = await createTestCase(owner.id);

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		const changes: ElementChange[] = [];

		const notFoundResult = await applyBatchUpdate(
			otherUser.id,
			"00000000-0000-0000-0000-000000000000",
			changes
		);
		const noAccessResult = await applyBatchUpdate(
			otherUser.id,
			testCase.id,
			changes
		);

		expectSameError(notFoundResult, noAccessResult);
	});

	it("detects a conflict when expectedVersion does not match", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		// Use a stale timestamp that will not match the actual updatedAt
		const staleVersion = new Date(0).toISOString();
		const result = await applyBatchUpdate(user.id, testCase.id, [], {
			expectedVersion: staleVersion,
		});

		expectError(result, "Case has been modified by another user");
		expect("conflictDetected" in result && result.conflictDetected).toBe(true);
	});

	it("succeeds when expectedVersion matches the actual case version", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);

		// Fetch the real updatedAt to use as expected version
		const fresh = await prisma.assuranceCase.findUnique({
			where: { id: testCase.id },
			select: { updatedAt: true },
		});
		const expectedVersion = fresh?.updatedAt.toISOString();

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		expectSuccess(
			await applyBatchUpdate(user.id, testCase.id, [], {
				expectedVersion,
			})
		);
	});

	it("succeeds with an empty changes array (no-op)", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		const data = expectSuccess(
			await applyBatchUpdate(user.id, testCase.id, [])
		);
		expect(data.summary.created).toBe(0);
		expect(data.summary.updated).toBe(0);
		expect(data.summary.deleted).toBe(0);
	});

	it("links evidence to a claim via a batch update", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);

		// Create a property claim to link evidence to
		const claim = await createTestElement(testCase.id, user.id, {
			elementType: "PROPERTY_CLAIM",
			name: "A Claim",
			description: "Something to link evidence to",
		});

		// Create an evidence element (no parent — uses evidence_links)
		const evidence = await createTestElement(testCase.id, user.id, {
			elementType: "EVIDENCE",
			name: "Some Evidence",
			description: "Supporting evidence",
		});

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		const changes: ElementChange[] = [
			{
				type: "link_evidence",
				evidenceId: evidence.id,
				claimId: claim.id,
			},
		];

		expectSuccess(await applyBatchUpdate(user.id, testCase.id, changes));

		const link = await prisma.evidenceLink.findFirst({
			where: { evidenceId: evidence.id, claimId: claim.id },
		});
		expect(link).not.toBeNull();
	});

	it("is atomic — if one operation fails, all are rolled back", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);

		// Create an element to update (this operation will succeed)
		const element = await createTestElement(testCase.id, user.id, {
			elementType: "GOAL",
			name: "Should Remain Unchanged",
			description: "This update should be rolled back",
		});

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		const changes: ElementChange[] = [
			// Valid update
			{
				type: "update",
				elementId: element.id,
				data: { name: "Changed Name" },
			},
			// Delete a non-existent element — this will throw inside the transaction
			{
				type: "delete",
				elementId: "does-not-exist-at-all",
			},
		];

		// The batch should fail
		expectError(await applyBatchUpdate(user.id, testCase.id, changes));

		// The update should have been rolled back
		const unchanged = await prisma.assuranceElement.findUnique({
			where: { id: element.id },
		});
		expect(unchanged?.name).toBe("Should Remain Unchanged");
	});

	/**
	 * ADR 0004 D3: the batch/JSON-editor path now carries assertionStatus
	 * end-to-end (tree-diff.ts, case-batch-update-service.ts), enforcing the
	 * same write rule as the single-element route via element-service.ts's
	 * shared enforceAssertionStatusRules. Supersedes the former "PINS" test
	 * that documented this surface as deliberately unwired (see
	 * "TEA — assertionStatus surface completion (batch, undo-redo, UI)").
	 */
	describe("assertionStatus", () => {
		it("sets assertionStatus via a batch update and persists it", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const element = await createTestElement(testCase.id, user.id, {
				elementType: "GOAL",
				name: "Batch Target",
				description: "Original description",
			});
			expect(element.assertionStatus).toBeNull();

			const { applyBatchUpdate } = await import(
				"@/lib/services/case-batch-update-service"
			);

			const changes: ElementChange[] = [
				{
					type: "update",
					elementId: element.id,
					data: {
						name: "Batch Target Renamed",
						assertionStatus: "DEFEATED",
					},
				},
			];

			const data = expectSuccess(
				await applyBatchUpdate(user.id, testCase.id, changes)
			);
			expect(data.summary.updated).toBe(1);

			const afterBatch = await prisma.assuranceElement.findUnique({
				where: { id: element.id },
			});
			expect(afterBatch?.name).toBe("Batch Target Renamed");
			expect(afterBatch?.assertionStatus).toBe("DEFEATED");
		});

		it("leaves a previously-stored assertionStatus untouched when the field is absent from a partial update", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const element = await createTestElement(testCase.id, user.id, {
				elementType: "GOAL",
				name: "Batch Target",
				description: "Original description",
				assertionStatus: "ASSUMED",
			});
			expect(element.assertionStatus).toBe("ASSUMED");

			const { applyBatchUpdate } = await import(
				"@/lib/services/case-batch-update-service"
			);

			// data carries no assertionStatus key at all (not even null) —
			// a partial update that only touches name.
			const changes: ElementChange[] = [
				{
					type: "update",
					elementId: element.id,
					data: { name: "Renamed, Status Untouched" },
				},
			];

			const data = expectSuccess(
				await applyBatchUpdate(user.id, testCase.id, changes)
			);
			expect(data.summary.updated).toBe(1);

			const afterBatch = await prisma.assuranceElement.findUnique({
				where: { id: element.id },
			});
			expect(afterBatch?.name).toBe("Renamed, Status Untouched");
			// The stored value survives the omission — omission must never
			// be conflated with an explicit clear (null).
			expect(afterBatch?.assertionStatus).toBe("ASSUMED");
		});

		it("explicitly clears a previously-stored assertionStatus when the field is set to null", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const element = await createTestElement(testCase.id, user.id, {
				elementType: "GOAL",
				name: "Batch Target",
				description: "Original description",
				assertionStatus: "ASSUMED",
			});
			expect(element.assertionStatus).toBe("ASSUMED");

			const { applyBatchUpdate } = await import(
				"@/lib/services/case-batch-update-service"
			);

			const changes: ElementChange[] = [
				{
					type: "update",
					elementId: element.id,
					data: { assertionStatus: null },
				},
			];

			expectSuccess(await applyBatchUpdate(user.id, testCase.id, changes));

			const afterBatch = await prisma.assuranceElement.findUnique({
				where: { id: element.id },
			});
			expect(afterBatch?.assertionStatus).toBeNull();
		});

		it("rejects a system/machine principal batch-setting assertionStatus", async () => {
			const owner = await createTestUser();
			const { systemUser } = await createTestIntegrationWithSystemUser(
				owner.id
			);
			const testCase = await createTestCase(owner.id);
			// Genuine EDIT grant, same as grantIntegrationCaseAccess in production.
			await createTestPermission(testCase.id, systemUser.id, owner.id, "EDIT");
			const element = await createTestElement(testCase.id, owner.id, {
				elementType: "GOAL",
				name: "Batch Target",
			});

			const { applyBatchUpdate } = await import(
				"@/lib/services/case-batch-update-service"
			);

			const changes: ElementChange[] = [
				{
					type: "update",
					elementId: element.id,
					data: { assertionStatus: "DEFEATED" },
				},
			];

			expectError(
				await applyBatchUpdate(systemUser.id, testCase.id, changes),
				ASSERTION_STATUS_PERMISSION_DENIED_PATTERN
			);

			const afterBatch = await prisma.assuranceElement.findUnique({
				where: { id: element.id },
			});
			expect(afterBatch?.assertionStatus).toBeNull();
		});

		it("rejects a hand-declared AS_CITED via a batch update", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const element = await createTestElement(testCase.id, user.id, {
				elementType: "GOAL",
				name: "Batch Target",
			});

			const { applyBatchUpdate } = await import(
				"@/lib/services/case-batch-update-service"
			);

			const changes: ElementChange[] = [
				{
					type: "update",
					elementId: element.id,
					data: { assertionStatus: "AS_CITED" },
				},
			];

			expectError(
				await applyBatchUpdate(user.id, testCase.id, changes),
				AS_CITED_PATTERN
			);

			const afterBatch = await prisma.assuranceElement.findUnique({
				where: { id: element.id },
			});
			expect(afterBatch?.assertionStatus).toBeNull();
		});

		it("rejects a system/machine principal batch-creating an element with assertionStatus", async () => {
			const owner = await createTestUser();
			const { systemUser } = await createTestIntegrationWithSystemUser(
				owner.id
			);
			const testCase = await createTestCase(owner.id);
			await createTestPermission(testCase.id, systemUser.id, owner.id, "EDIT");

			const { applyBatchUpdate } = await import(
				"@/lib/services/case-batch-update-service"
			);

			const newId = `element-assertion-status-create-${Date.now()}`;
			const changes: ElementChange[] = [
				{
					type: "create",
					elementId: newId,
					parentId: null,
					data: {
						id: newId,
						type: "GOAL",
						name: "Machine-Created Goal",
						description: "Created by a system user",
						inSandbox: false,
						role: "TOP_LEVEL",
						assertionStatus: "ASSUMED",
					},
				},
			];

			expectError(
				await applyBatchUpdate(systemUser.id, testCase.id, changes),
				ASSERTION_STATUS_PERMISSION_DENIED_PATTERN
			);

			const created = await prisma.assuranceElement.findUnique({
				where: { id: newId },
			});
			expect(created).toBeNull();
		});
	});

	/**
	 * ADR 0004 D5 review fix item 2 — D3-pattern negative test (same lesson
	 * as api-elements-cited-element-id.test.ts's header comment: hand-
	 * maintained field allowlists silently drop unforwarded fields, so a
	 * malicious/careless payload can't smuggle a field through by riding
	 * along with a legitimate change). `UpdateElementData`
	 * (lib/case/tree-diff.ts) and `buildUpdateData`'s field allowlist
	 * (case-batch-update-service.ts) do not include citedElementId, so it is
	 * silently dropped here even though the object smuggling it is well-
	 * typed enough to pass a loose caller. No production change accompanies
	 * this test — it pins existing (correct) behaviour.
	 */
	it("ignores a smuggled citedElementId in a batch update, applying only the allowlisted change", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);
		const awayCase = await createTestCase(user.id);
		const originalCitedGoal = await createTestElement(awayCase.id, user.id, {
			elementType: "GOAL",
			name: "Original Cited Goal",
		});
		const smuggledCitedGoal = await createTestElement(awayCase.id, user.id, {
			elementType: "GOAL",
			name: "Smuggled Cited Goal",
		});
		const awayGoal = await createTestElement(testCase.id, user.id, {
			elementType: "AWAY_GOAL",
			name: "Original Name",
			moduleReferenceId: awayCase.id,
			citedElementId: originalCitedGoal.id,
		});

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		// citedElementId is not part of UpdateElementData — smuggled here via
		// an `as` cast to simulate a caller that bypasses the type system
		// (e.g. a hand-built JSON payload to the batch API route).
		const changes = [
			{
				type: "update",
				elementId: awayGoal.id,
				data: {
					name: "Updated Name",
					citedElementId: smuggledCitedGoal.id,
				},
			},
		] as unknown as ElementChange[];

		expectSuccess(await applyBatchUpdate(user.id, testCase.id, changes));

		const updated = await prisma.assuranceElement.findUnique({
			where: { id: awayGoal.id },
		});
		// Allowlisted change applied.
		expect(updated?.name).toBe("Updated Name");
		// Smuggled field had no effect — original citation is untouched.
		expect(updated?.citedElementId).toBe(originalCitedGoal.id);
	});
});
