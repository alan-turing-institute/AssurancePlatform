import { Client } from "pg";
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
 * Counts SQL statements by spying on `pg`'s `Client.prototype.query` — the
 * seam BELOW Prisma's driver adapter that BOTH the plain `prisma` client
 * and every `tx.`-scoped call inside `prisma.$transaction(async (tx) =>
 * ...)` funnel through (confirmed by reading `@prisma/adapter-pg`: a
 * one-off `prisma.x()` call runs `pool.query()`, which itself checks out a
 * client and calls `client.query()`; a `$transaction` callback's `tx.x()`
 * calls run directly on the checked-out client via the same `.query()`
 * method). A spy on Prisma's own model methods, or on `prisma.$on("query")`,
 * only ever sees queries against the top-level client — per the Prisma
 * interactive-tx gotcha (see repo notes), it never fires for queries run
 * through `tx`, which is exactly the surface most of this commit's batching
 * (fetchLevelInfo, applyUpdates, applyCreates) targets. Spying at the `pg`
 * level instead observes every physical SQL statement regardless of which
 * Prisma client object issued it — `vi.spyOn` without a mock implementation
 * calls through to the real driver, so the query still runs normally.
 */
function spyOnSql() {
	return vi.spyOn(Client.prototype, "query");
}

/** Extracts the SQL text of every call recorded by `spyOnSql()`. */
function sqlTextsFrom(spy: ReturnType<typeof spyOnSql>): string[] {
	return spy.mock.calls
		.map((call) => call[0])
		.map((arg) =>
			typeof arg === "string"
				? arg
				: (arg as { text?: string } | undefined)?.text
		)
		.filter((text): text is string => Boolean(text));
}

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

	/**
	 * perf/n-plus-one-batching (2026-08-25): validateUpdateParents now runs a
	 * single shared multi-root BFS (getDescendantIdsForRoots) for every
	 * update in a batch that moves an element, instead of one
	 * getDescendantIds walk per update. No prior test exercised the circular-
	 * reference check at all — these pin both the correctness (same error,
	 * same conditions as the old per-update walk) and the query-count shape
	 * of the new shared sweep.
	 */
	describe("circular-reference validation (validateUpdateParents)", () => {
		it("rejects moving an element to be its own parent", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const element = await createTestElement(testCase.id, user.id, {
				elementType: "GOAL",
			});

			const { applyBatchUpdate } = await import(
				"@/lib/services/case-batch-update-service"
			);

			const changes: ElementChange[] = [
				{
					type: "update",
					elementId: element.id,
					data: { parentId: element.id },
				},
			];

			expectError(
				await applyBatchUpdate(user.id, testCase.id, changes),
				`Circular reference detected when moving element ${element.id}`
			);
		});

		it("rejects moving an element under its own descendant", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const root = await createTestElement(testCase.id, user.id, {
				elementType: "GOAL",
			});
			const child = await createTestElement(testCase.id, user.id, {
				elementType: "STRATEGY",
				parentId: root.id,
			});
			const grandchild = await createTestElement(testCase.id, user.id, {
				elementType: "PROPERTY_CLAIM",
				parentId: child.id,
			});

			const { applyBatchUpdate } = await import(
				"@/lib/services/case-batch-update-service"
			);

			const changes: ElementChange[] = [
				{
					type: "update",
					elementId: root.id,
					data: { parentId: grandchild.id },
				},
			];

			expectError(
				await applyBatchUpdate(user.id, testCase.id, changes),
				`Circular reference detected when moving element ${root.id}`
			);

			// Rejected — the move must not have been applied.
			const unchanged = await prisma.assuranceElement.findUnique({
				where: { id: root.id },
			});
			expect(unchanged?.parentId).toBeNull();
		});

		it("allows a valid re-parent that does not create a cycle", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const mover = await createTestElement(testCase.id, user.id, {
				elementType: "GOAL",
			});
			const newParent = await createTestElement(testCase.id, user.id, {
				elementType: "GOAL",
			});

			const { applyBatchUpdate } = await import(
				"@/lib/services/case-batch-update-service"
			);

			const changes: ElementChange[] = [
				{
					type: "update",
					elementId: mover.id,
					data: { parentId: newParent.id },
				},
			];

			const data = expectSuccess(
				await applyBatchUpdate(user.id, testCase.id, changes)
			);
			expect(data.summary.updated).toBe(1);

			const moved = await prisma.assuranceElement.findUnique({
				where: { id: mover.id },
			});
			expect(moved?.parentId).toBe(newParent.id);
		});

		it("detects a circular reference among several updates in the same batch (multi-root BFS)", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			// One safe re-parent, unrelated to the cycle below.
			const validMover = await createTestElement(testCase.id, user.id, {
				elementType: "GOAL",
			});
			const validTarget = await createTestElement(testCase.id, user.id, {
				elementType: "GOAL",
			});
			// A cycle two levels deep.
			const root = await createTestElement(testCase.id, user.id, {
				elementType: "GOAL",
			});
			const child = await createTestElement(testCase.id, user.id, {
				elementType: "STRATEGY",
				parentId: root.id,
			});
			const grandchild = await createTestElement(testCase.id, user.id, {
				elementType: "PROPERTY_CLAIM",
				parentId: child.id,
			});

			const { applyBatchUpdate } = await import(
				"@/lib/services/case-batch-update-service"
			);

			const changes: ElementChange[] = [
				{
					type: "update",
					elementId: validMover.id,
					data: { parentId: validTarget.id },
				},
				{
					type: "update",
					elementId: root.id,
					data: { parentId: grandchild.id },
				},
			];

			expectError(
				await applyBatchUpdate(user.id, testCase.id, changes),
				`Circular reference detected when moving element ${root.id}`
			);

			// Atomic — the valid re-parent in the same batch must also be
			// rolled back, even though it wasn't the one that failed.
			const unmoved = await prisma.assuranceElement.findUnique({
				where: { id: validMover.id },
			});
			expect(unmoved?.parentId).toBeNull();
		});

		it("shares one BFS sweep across N update roots instead of one walk per update", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const validTarget = await createTestElement(testCase.id, user.id, {
				elementType: "GOAL",
			});
			// Five independent, single-level, cycle-free roots. A per-update
			// walk (one getDescendantIds call per update) would issue 5
			// descendant-fetch queries here — one per root, each terminating
			// immediately since none of these roots have children. The
			// shared BFS instead fetches every root's children in one
			// findMany, then one more findMany confirms none of those
			// children have children of their own: 2 queries total,
			// regardless of how many roots are in the batch.
			const roots: Awaited<ReturnType<typeof createTestElement>>[] = [];
			for (let i = 0; i < 5; i++) {
				const root = await createTestElement(testCase.id, user.id, {
					elementType: "GOAL",
				});
				await createTestElement(testCase.id, user.id, {
					elementType: "STRATEGY",
					parentId: root.id,
				});
				roots.push(root);
			}

			const { applyBatchUpdate } = await import(
				"@/lib/services/case-batch-update-service"
			);

			const spy = spyOnSql();
			const changes: ElementChange[] = roots.map((root) => ({
				type: "update",
				elementId: root.id,
				data: { parentId: validTarget.id },
			}));
			const data = expectSuccess(
				await applyBatchUpdate(user.id, testCase.id, changes)
			);
			const texts = sqlTextsFrom(spy);
			spy.mockRestore();

			expect(data.summary.updated).toBe(roots.length);

			const descendantQueries = texts.filter((t) =>
				t.includes('"parent_id" IN')
			);
			expect(descendantQueries.length).toBe(2);
			expect(descendantQueries.length).toBeLessThan(roots.length);
		});
	});

	/**
	 * perf/n-plus-one-batching (2026-08-25): applyUpdates now fetches
	 * {level, elementType} for every moved element and every referenced new
	 * parent in two batched findMany calls, with a local `recalculatedLevels`
	 * map correcting for parents that were themselves moved earlier in the
	 * same batch — the trickiest new logic in the commit, and previously
	 * uncovered.
	 */
	describe("intra-batch level chaining (applyUpdates)", () => {
		it("resolves levels sequentially when a parent move and a child-of-that-parent move share a batch", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const goal = await createTestElement(testCase.id, user.id, {
				elementType: "GOAL",
			});
			// newParent is a top-level property claim (level resolves to 1
			// once the service touches it — direct factory inserts leave
			// `level` null, same as production rows created outside this
			// service).
			const newParent = await createTestElement(testCase.id, user.id, {
				elementType: "PROPERTY_CLAIM",
				parentId: goal.id,
			});
			const claimA = await createTestElement(testCase.id, user.id, {
				elementType: "PROPERTY_CLAIM",
				parentId: goal.id,
			});
			const claimB = await createTestElement(testCase.id, user.id, {
				elementType: "PROPERTY_CLAIM",
				parentId: goal.id,
			});

			const { applyBatchUpdate } = await import(
				"@/lib/services/case-batch-update-service"
			);

			// A moves under newParent (level 1) FIRST, then B moves under A
			// in the SAME call. If levels were computed from a stale
			// pre-transaction snapshot instead of chaining, B would resolve
			// against A's OLD level rather than the level A gets in this
			// same batch.
			const changes: ElementChange[] = [
				{
					type: "update",
					elementId: claimA.id,
					data: { parentId: newParent.id },
				},
				{
					type: "update",
					elementId: claimB.id,
					data: { parentId: claimA.id },
				},
			];

			const data = expectSuccess(
				await applyBatchUpdate(user.id, testCase.id, changes)
			);
			expect(data.summary.updated).toBe(2);

			const [afterA, afterB] = await Promise.all([
				prisma.assuranceElement.findUnique({ where: { id: claimA.id } }),
				prisma.assuranceElement.findUnique({ where: { id: claimB.id } }),
			]);
			// newParent has no level set (null, treated as base 1), so A's
			// new level is 1 + 1 = 2.
			expect(afterA?.level).toBe(2);
			// B must chain off A's NEW level (2), not A's stale pre-batch
			// level (null) — 2 + 1 = 3.
			expect(afterB?.level).toBe(3);
		});

		/**
		 * fix/batch-level-order-independence (2026-08-25): levels are now
		 * resolved from the FINAL post-batch parent arrangement
		 * (`resolveFinalLevelsForBatch`), not by chaining updates in array
		 * order — so a child-move listed before its parent-move produces
		 * the SAME correct levels as the reverse order. Runs the batch both
		 * ways against fresh fixtures and asserts identical results.
		 */
		describe("order-independent level resolution", () => {
			it("resolves the same correct levels whether the child-move or the parent-move is listed first", async () => {
				const user = await createTestUser();

				async function runBatch(order: "child-first" | "parent-first") {
					const caseForRun = await createTestCase(user.id);
					const goal = await createTestElement(caseForRun.id, user.id, {
						elementType: "GOAL",
					});
					const newParent = await createTestElement(caseForRun.id, user.id, {
						elementType: "PROPERTY_CLAIM",
						parentId: goal.id,
					});
					const claimA = await createTestElement(caseForRun.id, user.id, {
						elementType: "PROPERTY_CLAIM",
						parentId: goal.id,
					});
					const claimB = await createTestElement(caseForRun.id, user.id, {
						elementType: "PROPERTY_CLAIM",
						parentId: goal.id,
					});

					const { applyBatchUpdate } = await import(
						"@/lib/services/case-batch-update-service"
					);

					const parentMove: ElementChange = {
						type: "update",
						elementId: claimA.id,
						data: { parentId: newParent.id },
					};
					const childMove: ElementChange = {
						type: "update",
						elementId: claimB.id,
						data: { parentId: claimA.id },
					};
					const changes: ElementChange[] =
						order === "child-first"
							? [childMove, parentMove]
							: [parentMove, childMove];

					const data = expectSuccess(
						await applyBatchUpdate(user.id, caseForRun.id, changes)
					);
					expect(data.summary.updated).toBe(2);

					const [afterA, afterB] = await Promise.all([
						prisma.assuranceElement.findUnique({ where: { id: claimA.id } }),
						prisma.assuranceElement.findUnique({ where: { id: claimB.id } }),
					]);
					return { levelA: afterA?.level, levelB: afterB?.level };
				}

				const childFirst = await runBatch("child-first");
				const parentFirst = await runBatch("parent-first");

				// A moves under newParent (level 1, since newParent's own
				// parent is the GOAL): A's new level is 1 + 1 = 2.
				expect(childFirst.levelA).toBe(2);
				expect(parentFirst.levelA).toBe(2);
				// B moves under A. Correctly chained off A's FINAL level (2),
				// not A's stale pre-batch level: B's new level is 2 + 1 = 3 —
				// identically, regardless of which update was listed first.
				expect(childFirst.levelB).toBe(3);
				expect(parentFirst.levelB).toBe(3);
				expect(childFirst).toEqual(parentFirst);
			});

			it("still rejects a cycle created purely by this batch's own moves (not visible to the pre-batch descendant check)", async () => {
				const user = await createTestUser();
				const testCase = await createTestCase(user.id);
				const goal = await createTestElement(testCase.id, user.id, {
					elementType: "GOAL",
				});
				// Two property claims, both currently children of `goal` —
				// neither is a descendant of the other in the database, so
				// `validateUpdateParents`'s pre-batch BFS can't see the
				// cycle this batch is about to create by moving each under
				// the other.
				const claimX = await createTestElement(testCase.id, user.id, {
					elementType: "PROPERTY_CLAIM",
					parentId: goal.id,
				});
				const claimY = await createTestElement(testCase.id, user.id, {
					elementType: "PROPERTY_CLAIM",
					parentId: goal.id,
				});

				const { applyBatchUpdate } = await import(
					"@/lib/services/case-batch-update-service"
				);

				const changes: ElementChange[] = [
					{
						type: "update",
						elementId: claimX.id,
						data: { parentId: claimY.id },
					},
					{
						type: "update",
						elementId: claimY.id,
						data: { parentId: claimX.id },
					},
				];

				const result = await applyBatchUpdate(user.id, testCase.id, changes);
				expect("error" in result).toBe(true);
				if ("error" in result) {
					expect(
						result.error.startsWith(
							"Circular reference detected when moving element "
						)
					).toBe(true);
				}

				// Atomic — neither move should have been applied.
				const [unmovedX, unmovedY] = await Promise.all([
					prisma.assuranceElement.findUnique({ where: { id: claimX.id } }),
					prisma.assuranceElement.findUnique({ where: { id: claimY.id } }),
				]);
				expect(unmovedX?.parentId).toBe(goal.id);
				expect(unmovedY?.parentId).toBe(goal.id);
			});
		});

		describe("descendant cascade recompute", () => {
			it("recomputes an un-listed descendant's level when its ancestor is moved deeper in the same batch", async () => {
				const user = await createTestUser();
				const testCase = await createTestCase(user.id);
				const goal = await createTestElement(testCase.id, user.id, {
					elementType: "GOAL",
				});
				const newParent = await createTestElement(testCase.id, user.id, {
					elementType: "PROPERTY_CLAIM",
					parentId: goal.id,
				});
				// claimA moves under newParent (new level 2). claimChild
				// stays put — it is NOT listed in `changes` — but its
				// parent (claimA) just got deeper, so claimChild's level
				// must cascade from 2 (1 + 1, under the old top-level
				// claimA) to 3 (2 + 1, under claimA's new level).
				const claimA = await createTestElement(testCase.id, user.id, {
					elementType: "PROPERTY_CLAIM",
					parentId: goal.id,
				});
				const claimChildRaw = await createTestElement(testCase.id, user.id, {
					elementType: "PROPERTY_CLAIM",
					parentId: claimA.id,
				});
				const claimChild = await prisma.assuranceElement.update({
					where: { id: claimChildRaw.id },
					data: { level: 2 },
				});
				const claimGrandchildRaw = await createTestElement(
					testCase.id,
					user.id,
					{
						elementType: "PROPERTY_CLAIM",
						parentId: claimChild.id,
					}
				);
				const claimGrandchild = await prisma.assuranceElement.update({
					where: { id: claimGrandchildRaw.id },
					data: { level: 3 },
				});

				const { applyBatchUpdate } = await import(
					"@/lib/services/case-batch-update-service"
				);

				const changes: ElementChange[] = [
					{
						type: "update",
						elementId: claimA.id,
						data: { parentId: newParent.id },
					},
				];

				const data = expectSuccess(
					await applyBatchUpdate(user.id, testCase.id, changes)
				);
				expect(data.summary.updated).toBe(1);

				const [afterA, afterChild, afterGrandchild] = await Promise.all([
					prisma.assuranceElement.findUnique({ where: { id: claimA.id } }),
					prisma.assuranceElement.findUnique({ where: { id: claimChild.id } }),
					prisma.assuranceElement.findUnique({
						where: { id: claimGrandchild.id },
					}),
				]);
				expect(afterA?.level).toBe(2);
				expect(afterChild?.level).toBe(3);
				expect(afterGrandchild?.level).toBe(4);
			});

			/**
			 * QA follow-up (fix/batch-level-order-independence): a moved
			 * element's descendant can ITSELF be explicitly moved elsewhere
			 * in the same batch. `cascadeFromRoot` documents that it stops
			 * descending at such a node (its level comes from
			 * `resolveFinalLevelsForBatch`/its own separate `cascadeFromRoot`
			 * call instead) — this pins that both halves actually produce
			 * the right numbers: the nested mover resolves off its OWN new
			 * parent (not the ancestor that moved above it), and ITS
			 * un-listed child cascades from the nested mover's new position,
			 * not from the top-level move.
			 */
			it("resolves a nested mover (a moved descendant of another moved element) from its own new parent, and cascades its own un-listed child from there", async () => {
				const user = await createTestUser();
				const testCase = await createTestCase(user.id);
				const goal = await createTestElement(testCase.id, user.id, {
					elementType: "GOAL",
				});

				// A's new parent chain: x1 (level 1) -> x (level 2).
				const x1 = await createTestElement(testCase.id, user.id, {
					elementType: "PROPERTY_CLAIM",
					parentId: goal.id,
				});
				await prisma.assuranceElement.update({
					where: { id: x1.id },
					data: { level: 1 },
				});
				const x = await createTestElement(testCase.id, user.id, {
					elementType: "PROPERTY_CLAIM",
					parentId: x1.id,
				});
				await prisma.assuranceElement.update({
					where: { id: x.id },
					data: { level: 2 },
				});

				// B's new parent chain: y1 (level 1) -> y2 (level 2) -> y
				// (level 3) — deliberately deeper than A's target, so a bug
				// that resolved B off A's new position (rather than B's own
				// new parent y) would produce a visibly different, wrong
				// number.
				const y1 = await createTestElement(testCase.id, user.id, {
					elementType: "PROPERTY_CLAIM",
					parentId: goal.id,
				});
				await prisma.assuranceElement.update({
					where: { id: y1.id },
					data: { level: 1 },
				});
				const y2 = await createTestElement(testCase.id, user.id, {
					elementType: "PROPERTY_CLAIM",
					parentId: y1.id,
				});
				await prisma.assuranceElement.update({
					where: { id: y2.id },
					data: { level: 2 },
				});
				const y = await createTestElement(testCase.id, user.id, {
					elementType: "PROPERTY_CLAIM",
					parentId: y2.id,
				});
				await prisma.assuranceElement.update({
					where: { id: y.id },
					data: { level: 3 },
				});

				// The pre-batch chain being rearranged: a (level 1, child of
				// goal) -> b (level 2, child of a) -> c (level 3, child of
				// b, NOT listed in this batch's changes).
				const a = await createTestElement(testCase.id, user.id, {
					elementType: "PROPERTY_CLAIM",
					parentId: goal.id,
				});
				await prisma.assuranceElement.update({
					where: { id: a.id },
					data: { level: 1 },
				});
				const b = await createTestElement(testCase.id, user.id, {
					elementType: "PROPERTY_CLAIM",
					parentId: a.id,
				});
				await prisma.assuranceElement.update({
					where: { id: b.id },
					data: { level: 2 },
				});
				const c = await createTestElement(testCase.id, user.id, {
					elementType: "PROPERTY_CLAIM",
					parentId: b.id,
				});
				await prisma.assuranceElement.update({
					where: { id: c.id },
					data: { level: 3 },
				});

				const { applyBatchUpdate } = await import(
					"@/lib/services/case-batch-update-service"
				);

				// a moves under x (independent target); b — a's own
				// pre-batch child — moves under y (also independent, NOT
				// under a's new position). c is left unlisted.
				const changes: ElementChange[] = [
					{
						type: "update",
						elementId: a.id,
						data: { parentId: x.id },
					},
					{
						type: "update",
						elementId: b.id,
						data: { parentId: y.id },
					},
				];

				const data = expectSuccess(
					await applyBatchUpdate(user.id, testCase.id, changes)
				);
				expect(data.summary.updated).toBe(2);

				const [afterA, afterB, afterC] = await Promise.all([
					prisma.assuranceElement.findUnique({ where: { id: a.id } }),
					prisma.assuranceElement.findUnique({ where: { id: b.id } }),
					prisma.assuranceElement.findUnique({ where: { id: c.id } }),
				]);

				// a resolves off x (level 2): 2 + 1 = 3.
				expect(afterA?.level).toBe(3);
				// b resolves off ITS OWN new parent y (level 3), not off a's
				// new level: 3 + 1 = 4. If the cascade/resolution wrongly
				// chained b off a instead, this would read 4 too by
				// coincidence in some configurations — the un-listed
				// grandchild assertion below is what actually distinguishes
				// "chained off a" from "resolved off b's own new parent".
				expect(afterB?.level).toBe(4);
				// c is un-listed, and its parent b is itself a nested mover
				// (a moved descendant of a moved element). c must cascade
				// from b's NEW position (4 + 1 = 5), not be left at its
				// stale pre-batch value (3) and not be swept up into a's
				// cascade (which must stop at b, since b is a listed move).
				expect(afterC?.level).toBe(5);
			});

			/**
			 * QA follow-up: three generations moved in the same batch,
			 * listed in the worst possible order (child first, grandparent
			 * last — the exact reverse of the dependency order a naive
			 * chaining implementation would need).
			 */
			it("resolves a three-generation move chain correctly when listed child-first, parent-second, grandparent-last", async () => {
				const user = await createTestUser();
				const testCase = await createTestCase(user.id);
				const goal = await createTestElement(testCase.id, user.id, {
					elementType: "GOAL",
				});
				// Grandparent's new external target: root (level 2).
				const root1 = await createTestElement(testCase.id, user.id, {
					elementType: "PROPERTY_CLAIM",
					parentId: goal.id,
				});
				await prisma.assuranceElement.update({
					where: { id: root1.id },
					data: { level: 1 },
				});
				const root = await createTestElement(testCase.id, user.id, {
					elementType: "PROPERTY_CLAIM",
					parentId: root1.id,
				});
				await prisma.assuranceElement.update({
					where: { id: root.id },
					data: { level: 2 },
				});

				const gp = await createTestElement(testCase.id, user.id, {
					elementType: "PROPERTY_CLAIM",
					parentId: goal.id,
				});
				const p = await createTestElement(testCase.id, user.id, {
					elementType: "PROPERTY_CLAIM",
					parentId: gp.id,
				});
				const ch = await createTestElement(testCase.id, user.id, {
					elementType: "PROPERTY_CLAIM",
					parentId: p.id,
				});

				const { applyBatchUpdate } = await import(
					"@/lib/services/case-batch-update-service"
				);

				// Worst-case order: the child-move needs its parent's FINAL
				// level, and the parent-move needs the grandparent's FINAL
				// level — both listed before the moves they depend on.
				const changes: ElementChange[] = [
					{ type: "update", elementId: ch.id, data: { parentId: p.id } },
					{ type: "update", elementId: p.id, data: { parentId: gp.id } },
					{ type: "update", elementId: gp.id, data: { parentId: root.id } },
				];

				const data = expectSuccess(
					await applyBatchUpdate(user.id, testCase.id, changes)
				);
				expect(data.summary.updated).toBe(3);

				const [afterGp, afterP, afterCh] = await Promise.all([
					prisma.assuranceElement.findUnique({ where: { id: gp.id } }),
					prisma.assuranceElement.findUnique({ where: { id: p.id } }),
					prisma.assuranceElement.findUnique({ where: { id: ch.id } }),
				]);

				// gp moves under root (level 2): 2 + 1 = 3.
				expect(afterGp?.level).toBe(3);
				// p moves under gp's FINAL level (3): 3 + 1 = 4.
				expect(afterP?.level).toBe(4);
				// ch moves under p's FINAL level (4): 4 + 1 = 5.
				expect(afterCh?.level).toBe(5);
			});

			/**
			 * QA follow-up: the cascade must also LOWER descendant levels
			 * when a move makes an element shallower, not just raise them
			 * (every existing cascade test only exercises a move that goes
			 * deeper).
			 */
			it("cascades a level DECREASE to un-listed descendants when a move makes an element shallower", async () => {
				const user = await createTestUser();
				const testCase = await createTestCase(user.id);
				const goal = await createTestElement(testCase.id, user.id, {
					elementType: "GOAL",
				});

				// mover's pre-batch chain: dp1 (1) -> dp2 (2) -> dp3 (3) ->
				// mover (4) -> moverChild (5).
				const dp1 = await createTestElement(testCase.id, user.id, {
					elementType: "PROPERTY_CLAIM",
					parentId: goal.id,
				});
				await prisma.assuranceElement.update({
					where: { id: dp1.id },
					data: { level: 1 },
				});
				const dp2 = await createTestElement(testCase.id, user.id, {
					elementType: "PROPERTY_CLAIM",
					parentId: dp1.id,
				});
				await prisma.assuranceElement.update({
					where: { id: dp2.id },
					data: { level: 2 },
				});
				const dp3 = await createTestElement(testCase.id, user.id, {
					elementType: "PROPERTY_CLAIM",
					parentId: dp2.id,
				});
				await prisma.assuranceElement.update({
					where: { id: dp3.id },
					data: { level: 3 },
				});
				const mover = await createTestElement(testCase.id, user.id, {
					elementType: "PROPERTY_CLAIM",
					parentId: dp3.id,
				});
				await prisma.assuranceElement.update({
					where: { id: mover.id },
					data: { level: 4 },
				});
				const moverChild = await createTestElement(testCase.id, user.id, {
					elementType: "PROPERTY_CLAIM",
					parentId: mover.id,
				});
				await prisma.assuranceElement.update({
					where: { id: moverChild.id },
					data: { level: 5 },
				});

				// mover's new, shallow target: a top-level property claim
				// (level 1, direct child of goal).
				const shallowTarget = await createTestElement(testCase.id, user.id, {
					elementType: "PROPERTY_CLAIM",
					parentId: goal.id,
				});
				await prisma.assuranceElement.update({
					where: { id: shallowTarget.id },
					data: { level: 1 },
				});

				const { applyBatchUpdate } = await import(
					"@/lib/services/case-batch-update-service"
				);

				const changes: ElementChange[] = [
					{
						type: "update",
						elementId: mover.id,
						data: { parentId: shallowTarget.id },
					},
				];

				const data = expectSuccess(
					await applyBatchUpdate(user.id, testCase.id, changes)
				);
				expect(data.summary.updated).toBe(1);

				const [afterMover, afterChild] = await Promise.all([
					prisma.assuranceElement.findUnique({ where: { id: mover.id } }),
					prisma.assuranceElement.findUnique({
						where: { id: moverChild.id },
					}),
				]);

				// mover: 1 + 1 = 2, DOWN from 4.
				expect(afterMover?.level).toBe(2);
				// moverChild cascades DOWN too: 2 + 1 = 3, from a stale 5.
				expect(afterChild?.level).toBe(3);
			});
		});

		/**
		 * QA follow-up: mirrors the existing "cycle created purely by this
		 * batch's own moves" test with the two updates listed in the
		 * OPPOSITE array order, to pin that cycle detection is as
		 * order-independent as level resolution itself.
		 */
		it("still rejects a batch-created cycle when the moves are listed in the reverse order", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const goal = await createTestElement(testCase.id, user.id, {
				elementType: "GOAL",
			});
			const claimX = await createTestElement(testCase.id, user.id, {
				elementType: "PROPERTY_CLAIM",
				parentId: goal.id,
			});
			const claimY = await createTestElement(testCase.id, user.id, {
				elementType: "PROPERTY_CLAIM",
				parentId: goal.id,
			});

			const { applyBatchUpdate } = await import(
				"@/lib/services/case-batch-update-service"
			);

			// Reverse of the existing test's order: Y's move is listed
			// before X's.
			const changes: ElementChange[] = [
				{
					type: "update",
					elementId: claimY.id,
					data: { parentId: claimX.id },
				},
				{
					type: "update",
					elementId: claimX.id,
					data: { parentId: claimY.id },
				},
			];

			const result = await applyBatchUpdate(user.id, testCase.id, changes);
			expect("error" in result).toBe(true);
			if ("error" in result) {
				expect(
					result.error.startsWith(
						"Circular reference detected when moving element "
					)
				).toBe(true);
			}

			const [unmovedX, unmovedY] = await Promise.all([
				prisma.assuranceElement.findUnique({ where: { id: claimX.id } }),
				prisma.assuranceElement.findUnique({ where: { id: claimY.id } }),
			]);
			expect(unmovedX?.parentId).toBe(goal.id);
			expect(unmovedY?.parentId).toBe(goal.id);
		});

		/**
		 * QA follow-up: evidence elements are linked via evidence_links, not
		 * parented (`buildCreateData` always forces their `parentId` to
		 * null) — this pins that an evidence element riding along in a
		 * batch that also moves property claims is never swept into level
		 * resolution or the descendant cascade.
		 */
		it("leaves an evidence element's level and parentId untouched by a batch that also moves property claims", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const goal = await createTestElement(testCase.id, user.id, {
				elementType: "GOAL",
			});
			const claim = await createTestElement(testCase.id, user.id, {
				elementType: "PROPERTY_CLAIM",
				parentId: goal.id,
			});
			await prisma.assuranceElement.update({
				where: { id: claim.id },
				data: { level: 1 },
			});
			const newParent = await createTestElement(testCase.id, user.id, {
				elementType: "PROPERTY_CLAIM",
				parentId: goal.id,
			});
			await prisma.assuranceElement.update({
				where: { id: newParent.id },
				data: { level: 1 },
			});
			const evidence = await createTestElement(testCase.id, user.id, {
				elementType: "EVIDENCE",
				name: "Supporting Evidence",
			});
			expect(evidence.parentId).toBeNull();
			expect(evidence.level).toBeNull();

			const { applyBatchUpdate } = await import(
				"@/lib/services/case-batch-update-service"
			);

			const changes: ElementChange[] = [
				{
					type: "update",
					elementId: claim.id,
					data: { parentId: newParent.id },
				},
				{
					type: "update",
					elementId: evidence.id,
					data: { name: "Renamed Evidence" },
				},
				{
					type: "link_evidence",
					evidenceId: evidence.id,
					claimId: claim.id,
				},
			];

			const data = expectSuccess(
				await applyBatchUpdate(user.id, testCase.id, changes)
			);
			expect(data.summary.updated).toBe(2);

			const afterEvidence = await prisma.assuranceElement.findUnique({
				where: { id: evidence.id },
			});
			expect(afterEvidence?.name).toBe("Renamed Evidence");
			// Never entered level resolution or the cascade — stays null and
			// unparented, evidence-link table carries the association.
			expect(afterEvidence?.level).toBeNull();
			expect(afterEvidence?.parentId).toBeNull();

			const link = await prisma.evidenceLink.findFirst({
				where: { evidenceId: evidence.id, claimId: claim.id },
			});
			expect(link).not.toBeNull();
		});

		/**
		 * QA follow-up: the descendant cascade added by this commit
		 * (`resolveDescendantCascadeLevels`/`applyCascadeLevelUpdates`) is
		 * exactly the kind of change the existing N+1 query-count seam
		 * exists to protect — pins that recomputing 6 un-listed descendants
		 * across 2 distinct new levels costs one descendant-row fetch and
		 * one grouped `updateMany` per distinct level (2 updateManys), not
		 * one query per descendant.
		 */
		it("cascades N un-listed descendants across few distinct levels with one descendant fetch and one updateMany per distinct level", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const goal = await createTestElement(testCase.id, user.id, {
				elementType: "GOAL",
			});
			const newParent = await createTestElement(testCase.id, user.id, {
				elementType: "PROPERTY_CLAIM",
				parentId: goal.id,
			});
			await prisma.assuranceElement.update({
				where: { id: newParent.id },
				data: { level: 1 },
			});

			// mover: level 1 (child of goal) -> moves under newParent
			// (level 1), so mover's new level is 2.
			const mover = await createTestElement(testCase.id, user.id, {
				elementType: "PROPERTY_CLAIM",
				parentId: goal.id,
			});
			await prisma.assuranceElement.update({
				where: { id: mover.id },
				data: { level: 1 },
			});

			// Three children of mover (all level 2 pre-batch, un-listed —
			// must cascade to 3), each with one child of its own (level 3
			// pre-batch, un-listed — must cascade to 4).
			for (let i = 0; i < 3; i++) {
				const child = await createTestElement(testCase.id, user.id, {
					elementType: "PROPERTY_CLAIM",
					parentId: mover.id,
				});
				await prisma.assuranceElement.update({
					where: { id: child.id },
					data: { level: 2 },
				});
				const grandchild = await createTestElement(testCase.id, user.id, {
					elementType: "PROPERTY_CLAIM",
					parentId: child.id,
				});
				await prisma.assuranceElement.update({
					where: { id: grandchild.id },
					data: { level: 3 },
				});
			}

			const { applyBatchUpdate } = await import(
				"@/lib/services/case-batch-update-service"
			);

			const changes: ElementChange[] = [
				{
					type: "update",
					elementId: mover.id,
					data: { parentId: newParent.id },
				},
			];

			const spy = spyOnSql();
			const data = expectSuccess(
				await applyBatchUpdate(user.id, testCase.id, changes)
			);
			const texts = sqlTextsFrom(spy);
			spy.mockRestore();

			expect(data.summary.updated).toBe(1);

			// Confirm the cascade actually ran and produced the expected
			// two distinct new levels (3 for the 3 children, 4 for the 3
			// grandchildren) before asserting query shape — a query-count
			// assertion alone can't tell "correctly batched" from "silently
			// did nothing".
			const descendants = await prisma.assuranceElement.findMany({
				where: { parentId: mover.id },
				select: { level: true },
			});
			expect(descendants.map((d) => d.level).sort()).toEqual([3, 3, 3]);
			const descendantsWithIds = await prisma.assuranceElement.findMany({
				where: { parentId: mover.id },
				select: { id: true, level: true },
			});
			const grandDescendants = await prisma.assuranceElement.findMany({
				where: { parentId: { in: descendantsWithIds.map((d) => d.id) } },
				select: { level: true },
			});
			expect(grandDescendants.map((d) => d.level).sort()).toEqual([4, 4, 4]);

			// One shared findMany for the descendant rows the cascade walks
			// (id/parent_id/element_type), regardless of how many
			// descendants exist.
			const descendantFetches = texts.filter((t) =>
				t.startsWith(
					'SELECT "public"."assurance_elements"."id", "public"."assurance_elements"."parent_id", "public"."assurance_elements"."element_type"'
				)
			);
			expect(descendantFetches.length).toBe(1);

			// One grouped updateMany per distinct new level (2: level 3 and
			// level 4), not one UPDATE per descendant (which would be 6).
			const cascadeUpdateManys = texts.filter((t) =>
				t.startsWith('UPDATE "public"."assurance_elements" SET "level"')
			);
			expect(cascadeUpdateManys.length).toBe(2);
			expect(cascadeUpdateManys.length).toBeLessThan(6);
		});
	});

	/**
	 * perf/n-plus-one-batching (2026-08-25): direct query-count assertions
	 * for the two batching changes most at risk of a silent N+1 regression
	 * creeping back in. Counts SQL via `Client.prototype.query` (see
	 * `spyOnSql` above) rather than mocking Prisma, specifically because
	 * some of the batched queries under test run through `tx`, not the
	 * top-level `prisma` client.
	 */
	describe("query-count regressions (N+1 batching)", () => {
		it("issues one parent lookup for N creates that share an existing parent, not one per create", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const parent = await createTestElement(testCase.id, user.id, {
				elementType: "GOAL",
			});

			const { applyBatchUpdate } = await import(
				"@/lib/services/case-batch-update-service"
			);

			const ids = Array.from(
				{ length: 5 },
				(_, i) => `el-create-count-${Date.now()}-${i}`
			);
			const changes: ElementChange[] = ids.map((id) => ({
				type: "create",
				elementId: id,
				parentId: parent.id,
				data: {
					id,
					type: "GOAL",
					name: `Created ${id}`,
					description: "batched create",
					inSandbox: false,
					role: "SUPPORTING",
				},
			}));

			const spy = spyOnSql();
			const data = expectSuccess(
				await applyBatchUpdate(user.id, testCase.id, changes)
			);
			const texts = sqlTextsFrom(spy);
			spy.mockRestore();

			expect(data.summary.created).toBe(ids.length);

			// Proof the counter observes tx-scoped queries, not just
			// top-level ones: every create runs via `tx.assuranceElement
			// .create` inside `prisma.$transaction`, so this asserts a
			// nonzero, exact count on a query we KNOW only exists inside the
			// transaction — a vacuous counter (one that silently sees
			// nothing from `tx`) would report 0 here instead of 5.
			const insertCount = texts.filter((t) =>
				t.startsWith('INSERT INTO "public"."assurance_elements"')
			).length;
			expect(insertCount).toBe(ids.length);

			// The actual batching assertion: one shared parent-existence
			// lookup for all 5 creates, not one findUnique per create.
			const parentLookups = texts.filter((t) =>
				t.startsWith(
					'SELECT "public"."assurance_elements"."id" FROM "public"."assurance_elements" WHERE "public"."assurance_elements"."id" IN'
				)
			);
			expect(parentLookups.length).toBe(1);
		});

		it("issues two level-info lookups for N moves under the same unrelated parent, not up to 2N", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const oldParent = await createTestElement(testCase.id, user.id, {
				elementType: "GOAL",
			});
			const newParent = await createTestElement(testCase.id, user.id, {
				elementType: "GOAL",
			});
			const claims = await Promise.all(
				Array.from({ length: 3 }, () =>
					createTestElement(testCase.id, user.id, {
						elementType: "PROPERTY_CLAIM",
						parentId: oldParent.id,
					})
				)
			);

			const { applyBatchUpdate } = await import(
				"@/lib/services/case-batch-update-service"
			);

			const changes: ElementChange[] = claims.map((claim) => ({
				type: "update",
				elementId: claim.id,
				data: { parentId: newParent.id },
			}));

			const spy = spyOnSql();
			const data = expectSuccess(
				await applyBatchUpdate(user.id, testCase.id, changes)
			);
			const texts = sqlTextsFrom(spy);
			spy.mockRestore();

			expect(data.summary.updated).toBe(claims.length);

			// Proof of tx-scoped visibility: one UPDATE per moved element,
			// all issued via `tx.assuranceElement.update`.
			const updateCount = texts.filter((t) =>
				t.startsWith('UPDATE "public"."assurance_elements" SET "parent_id"')
			).length;
			expect(updateCount).toBe(claims.length);

			// fetchLevelInfo runs twice per applyUpdates call regardless of
			// batch size: once for the moved elements' own type
			// (ownTypeById), once for the referenced new parents'
			// {level, elementType} (parentInfoById) — deduplicated by id, so
			// 3 moves under the SAME new parent still cost 2 queries, not
			// up to 2*3 = 6.
			const levelInfoLookups = texts.filter((t) =>
				t.startsWith(
					'SELECT "public"."assurance_elements"."id", "public"."assurance_elements"."level"'
				)
			);
			expect(levelInfoLookups.length).toBe(2);
		});
	});

	/**
	 * perf/n-plus-one-batching (2026-08-25): applyLinkEvidence/
	 * applyUnlinkEvidence now use a single createMany(skipDuplicates) /
	 * deleteMany(OR[...]) instead of a per-item findFirst-then-create /
	 * delete. These pin that the batched replacements keep the same
	 * idempotency semantics as the old per-item logic.
	 */
	describe("evidence link idempotency", () => {
		it("linking an already-linked evidence-claim pair again succeeds silently and does not duplicate the link", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const claim = await createTestElement(testCase.id, user.id, {
				elementType: "PROPERTY_CLAIM",
			});
			const evidence = await createTestElement(testCase.id, user.id, {
				elementType: "EVIDENCE",
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
			// Link again — same pair, already linked.
			expectSuccess(await applyBatchUpdate(user.id, testCase.id, changes));

			const linkCount = await prisma.evidenceLink.count({
				where: { evidenceId: evidence.id, claimId: claim.id },
			});
			expect(linkCount).toBe(1);
		});

		it("unlinking a non-existent evidence-claim pair is a silent no-op", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const claim = await createTestElement(testCase.id, user.id, {
				elementType: "PROPERTY_CLAIM",
			});
			const evidence = await createTestElement(testCase.id, user.id, {
				elementType: "EVIDENCE",
			});
			// Never linked.

			const { applyBatchUpdate } = await import(
				"@/lib/services/case-batch-update-service"
			);

			const changes: ElementChange[] = [
				{
					type: "unlink_evidence",
					evidenceId: evidence.id,
					claimId: claim.id,
				},
			];

			const data = expectSuccess(
				await applyBatchUpdate(user.id, testCase.id, changes)
			);
			// unlink changes don't have their own summary counter — success
			// with no error is the observable behaviour (matches the old
			// per-item deleteMany, which is also a no-op on zero matching
			// rows).
			expect(data.summary.deleted).toBe(0);

			const linkCount = await prisma.evidenceLink.count({
				where: { evidenceId: evidence.id, claimId: claim.id },
			});
			expect(linkCount).toBe(0);
		});
	});

	/**
	 * COVERAGE FIX (2026-08-25 fallow round): `resolveParentLevel` — the
	 * level-resolution closure inside `applyCreates` — was reachable only
	 * through a batch CREATE of a PROPERTY_CLAIM with a `parentId`, a path
	 * no existing test drove through (flagged at 0% coverage, CRAP 30.0).
	 * This test exercises both of its branches in one batch: a property
	 * claim parented to an element that already exists in the database
	 * (the "external parent" branch), and a second property claim parented
	 * to that FIRST one, which is only created earlier in this same batch
	 * (the "within-batch parent" branch).
	 */
	describe("level calculation via applyCreates (resolveParentLevel coverage)", () => {
		it("computes levels for a batch that creates a property claim under an existing parent, then another under it", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			// Existing property claim with no level set (null) — resolveParentLevel
			// treats a null parent level as 1, per its `parentLevel ?? 1` rule.
			const existingClaim = await createTestElement(testCase.id, user.id, {
				elementType: "PROPERTY_CLAIM",
			});

			const { applyBatchUpdate } = await import(
				"@/lib/services/case-batch-update-service"
			);

			const childId = `element-level-child-${Date.now()}`;
			const grandchildId = `element-level-grandchild-${Date.now()}`;

			const changes: ElementChange[] = [
				{
					type: "create",
					elementId: childId,
					parentId: existingClaim.id,
					data: {
						id: childId,
						type: "PROPERTY_CLAIM",
						name: "Child Claim",
						description: "Parented to an element already in the database",
						inSandbox: false,
					},
				},
				{
					type: "create",
					elementId: grandchildId,
					parentId: childId,
					data: {
						id: grandchildId,
						type: "PROPERTY_CLAIM",
						name: "Grandchild Claim",
						description:
							"Parented to another element created earlier in this same batch",
						inSandbox: false,
					},
				},
			];

			expectSuccess(await applyBatchUpdate(user.id, testCase.id, changes));

			const child = await prisma.assuranceElement.findUnique({
				where: { id: childId },
			});
			const grandchild = await prisma.assuranceElement.findUnique({
				where: { id: grandchildId },
			});

			// existingClaim.level is null -> treated as 1, so child = 1 + 1 = 2.
			expect(child?.level).toBe(2);
			// child isn't in the database yet when grandchild's level is
			// resolved (parent-before-child insert order within the same
			// transaction) — resolveParentLevel must resolve it from the
			// within-batch createMap/levelById tracking, not a DB read.
			expect(grandchild?.level).toBe(3);
		});
	});

	/**
	 * TEA — Batch endpoint does not verify element ownership against the
	 * case: `validateEditAccess` only confirms the caller has EDIT access to
	 * the TARGET case, never that the element ids the batch actually touches
	 * belong to that case. Without `validateElementOwnership`, a user with
	 * edit access to case A could write to, delete, re-parent, or evidence-
	 * link/unlink elements that live in case B (IDOR). Every change type
	 * that references an id expected to already exist is covered here.
	 */
	describe("cross-case element ownership (IDOR guard)", () => {
		it("rejects an update targeting an element that belongs to a different case", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const otherCase = await createTestCase(user.id);
			const foreignElement = await createTestElement(otherCase.id, user.id, {
				elementType: "GOAL",
			});

			const { applyBatchUpdate } = await import(
				"@/lib/services/case-batch-update-service"
			);

			const changes: ElementChange[] = [
				{
					type: "update",
					elementId: foreignElement.id,
					data: { name: "Hijacked" },
				},
			];

			expectError(await applyBatchUpdate(user.id, testCase.id, changes));

			const unchanged = await prisma.assuranceElement.findUnique({
				where: { id: foreignElement.id },
			});
			expect(unchanged?.name).not.toBe("Hijacked");
		});

		it("rejects a delete targeting an element that belongs to a different case", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const otherCase = await createTestCase(user.id);
			const foreignElement = await createTestElement(otherCase.id, user.id, {
				elementType: "GOAL",
			});

			const { applyBatchUpdate } = await import(
				"@/lib/services/case-batch-update-service"
			);

			const changes: ElementChange[] = [
				{ type: "delete", elementId: foreignElement.id },
			];

			expectError(await applyBatchUpdate(user.id, testCase.id, changes));

			const stillThere = await prisma.assuranceElement.findUnique({
				where: { id: foreignElement.id },
			});
			expect(stillThere).not.toBeNull();
		});

		it("rejects a create whose parentId belongs to a different case", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const otherCase = await createTestCase(user.id);
			const foreignParent = await createTestElement(otherCase.id, user.id, {
				elementType: "GOAL",
			});

			const { applyBatchUpdate } = await import(
				"@/lib/services/case-batch-update-service"
			);

			const newId = `element-foreign-parent-${Date.now()}`;
			const changes: ElementChange[] = [
				{
					type: "create",
					elementId: newId,
					parentId: foreignParent.id,
					data: {
						id: newId,
						type: "PROPERTY_CLAIM",
						name: "Smuggled Under Foreign Parent",
						description: "Should never be created",
						inSandbox: false,
					},
				},
			];

			expectError(await applyBatchUpdate(user.id, testCase.id, changes));

			const created = await prisma.assuranceElement.findUnique({
				where: { id: newId },
			});
			expect(created).toBeNull();
		});

		it("rejects an update that moves an element to a parentId belonging to a different case", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const mover = await createTestElement(testCase.id, user.id, {
				elementType: "PROPERTY_CLAIM",
			});
			const otherCase = await createTestCase(user.id);
			const foreignParent = await createTestElement(otherCase.id, user.id, {
				elementType: "GOAL",
			});

			const { applyBatchUpdate } = await import(
				"@/lib/services/case-batch-update-service"
			);

			const changes: ElementChange[] = [
				{
					type: "update",
					elementId: mover.id,
					data: { parentId: foreignParent.id },
				},
			];

			expectError(await applyBatchUpdate(user.id, testCase.id, changes));

			const unmoved = await prisma.assuranceElement.findUnique({
				where: { id: mover.id },
			});
			expect(unmoved?.parentId).toBeNull();
		});

		it("rejects link_evidence when the evidenceId belongs to a different case", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const claim = await createTestElement(testCase.id, user.id, {
				elementType: "PROPERTY_CLAIM",
			});
			const otherCase = await createTestCase(user.id);
			const foreignEvidence = await createTestElement(otherCase.id, user.id, {
				elementType: "EVIDENCE",
			});

			const { applyBatchUpdate } = await import(
				"@/lib/services/case-batch-update-service"
			);

			const changes: ElementChange[] = [
				{
					type: "link_evidence",
					evidenceId: foreignEvidence.id,
					claimId: claim.id,
				},
			];

			expectError(await applyBatchUpdate(user.id, testCase.id, changes));

			const link = await prisma.evidenceLink.findFirst({
				where: { evidenceId: foreignEvidence.id, claimId: claim.id },
			});
			expect(link).toBeNull();
		});

		it("rejects link_evidence when the claimId belongs to a different case", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const evidence = await createTestElement(testCase.id, user.id, {
				elementType: "EVIDENCE",
			});
			const otherCase = await createTestCase(user.id);
			const foreignClaim = await createTestElement(otherCase.id, user.id, {
				elementType: "PROPERTY_CLAIM",
			});

			const { applyBatchUpdate } = await import(
				"@/lib/services/case-batch-update-service"
			);

			const changes: ElementChange[] = [
				{
					type: "link_evidence",
					evidenceId: evidence.id,
					claimId: foreignClaim.id,
				},
			];

			expectError(await applyBatchUpdate(user.id, testCase.id, changes));

			const link = await prisma.evidenceLink.findFirst({
				where: { evidenceId: evidence.id, claimId: foreignClaim.id },
			});
			expect(link).toBeNull();
		});

		it("rejects unlink_evidence when the evidenceId belongs to a different case", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const claim = await createTestElement(testCase.id, user.id, {
				elementType: "PROPERTY_CLAIM",
			});
			const otherCase = await createTestCase(user.id);
			const foreignEvidence = await createTestElement(otherCase.id, user.id, {
				elementType: "EVIDENCE",
			});

			const { applyBatchUpdate } = await import(
				"@/lib/services/case-batch-update-service"
			);

			const changes: ElementChange[] = [
				{
					type: "unlink_evidence",
					evidenceId: foreignEvidence.id,
					claimId: claim.id,
				},
			];

			expectError(await applyBatchUpdate(user.id, testCase.id, changes));
		});

		it("rejects unlink_evidence when the claimId belongs to a different case", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const evidence = await createTestElement(testCase.id, user.id, {
				elementType: "EVIDENCE",
			});
			const otherCase = await createTestCase(user.id);
			const foreignClaim = await createTestElement(otherCase.id, user.id, {
				elementType: "PROPERTY_CLAIM",
			});

			const { applyBatchUpdate } = await import(
				"@/lib/services/case-batch-update-service"
			);

			const changes: ElementChange[] = [
				{
					type: "unlink_evidence",
					evidenceId: evidence.id,
					claimId: foreignClaim.id,
				},
			];

			expectError(await applyBatchUpdate(user.id, testCase.id, changes));
		});

		it("rejects the whole batch when a referenced elementId does not exist at all", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const { applyBatchUpdate } = await import(
				"@/lib/services/case-batch-update-service"
			);

			const changes: ElementChange[] = [
				{
					type: "update",
					elementId: "00000000-0000-0000-0000-000000000099",
					data: { name: "Ghost" },
				},
			];

			expectError(await applyBatchUpdate(user.id, testCase.id, changes));
		});

		it("accepts a batch-created id used as a parentId elsewhere in the same batch", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const { applyBatchUpdate } = await import(
				"@/lib/services/case-batch-update-service"
			);

			const parentId = `element-ownership-parent-${Date.now()}`;
			const childId = `element-ownership-child-${Date.now()}`;
			const changes: ElementChange[] = [
				{
					type: "create",
					elementId: parentId,
					parentId: null,
					data: {
						id: parentId,
						type: "GOAL",
						name: "Batch Parent",
						description: "Created earlier in this same batch",
						inSandbox: false,
					},
				},
				{
					type: "create",
					elementId: childId,
					parentId,
					data: {
						id: childId,
						type: "STRATEGY",
						name: "Batch Child",
						description: "Parented to a sibling create in this same batch",
						inSandbox: false,
					},
				},
			];

			const data = expectSuccess(
				await applyBatchUpdate(user.id, testCase.id, changes)
			);
			expect(data.summary.created).toBe(2);

			const child = await prisma.assuranceElement.findUnique({
				where: { id: childId },
			});
			expect(child?.parentId).toBe(parentId);
		});
	});

	/**
	 * TEA — Batch endpoint does not verify element ownership against the
	 * case (fold-in): the batch path's level rule (`levelFromParentInfo`,
	 * now `calculateLevelFromParentChain`) lacked the transparent-strategy
	 * grandparent hop that `element-service.ts`'s `calculatePropertyClaimLevel`
	 * already had for the single-element create route — a batch create under
	 * a STRATEGY silently landed at level 1 instead of following the
	 * grandparent PROPERTY_CLAIM. This pins that the batch and single-element
	 * paths now agree.
	 */
	describe("transparent-strategy grandparent hop (batch creates)", () => {
		it("computes a batch-created claim's level from its STRATEGY parent's PROPERTY_CLAIM grandparent", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const goal = await createTestElement(testCase.id, user.id, {
				elementType: "GOAL",
			});
			// grandparent: a top-level property claim.
			const grandparent = await createTestElement(testCase.id, user.id, {
				elementType: "PROPERTY_CLAIM",
				parentId: goal.id,
			});
			await prisma.assuranceElement.update({
				where: { id: grandparent.id },
				data: { level: 1 },
			});
			// parent: a strategy directly under the grandparent claim.
			const strategy = await createTestElement(testCase.id, user.id, {
				elementType: "STRATEGY",
				parentId: grandparent.id,
			});

			const { applyBatchUpdate } = await import(
				"@/lib/services/case-batch-update-service"
			);

			const newId = `element-transparent-strategy-${Date.now()}`;
			const changes: ElementChange[] = [
				{
					type: "create",
					elementId: newId,
					parentId: strategy.id,
					data: {
						id: newId,
						type: "PROPERTY_CLAIM",
						name: "Claim Under Strategy",
						description: "Should skip the strategy and use the grandparent",
						inSandbox: false,
					},
				},
			];

			expectSuccess(await applyBatchUpdate(user.id, testCase.id, changes));

			const created = await prisma.assuranceElement.findUnique({
				where: { id: newId },
			});
			// grandparent.level (1) + 1 = 2 — matches the single-element route
			// (element-service.ts's calculatePropertyClaimLevel).
			expect(created?.level).toBe(2);
		});
	});
});
