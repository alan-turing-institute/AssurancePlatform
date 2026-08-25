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
		 * Same rule as the OLD per-row `calculateLevel`, which read the
		 * parent's CURRENT row via `tx.findUnique` at the moment each update
		 * ran: if the array lists the child-move before the parent-move,
		 * neither the old code nor this batched replacement sees the
		 * parent's new level yet, because the parent's own update hasn't
		 * run. This is pre-existing, order-dependent behaviour that the
		 * commit's `recalculatedLevels` map is explicit about (see its
		 * docstring) — pinning it here, not flagging it as a regression.
		 */
		it("chains only in array order — a child-move listed before its parent-move sees the parent's pre-batch level", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const goal = await createTestElement(testCase.id, user.id, {
				elementType: "GOAL",
			});
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

			// B-under-A listed BEFORE A-under-newParent.
			const changes: ElementChange[] = [
				{
					type: "update",
					elementId: claimB.id,
					data: { parentId: claimA.id },
				},
				{
					type: "update",
					elementId: claimA.id,
					data: { parentId: newParent.id },
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
			// A still resolves correctly regardless of order — its parent
			// (newParent) was never itself moved in this batch.
			expect(afterA?.level).toBe(2);
			// B resolves against A's PRE-batch level (null, i.e. treated as
			// base 1) because A hadn't been updated yet when B was
			// processed: 1 + 1 = 2, not the "fully chained" 3.
			expect(afterB?.level).toBe(2);
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
});
