import { describe, expect, it, vi } from "vitest";
import type { ElementChange } from "@/lib/case/tree-diff";
import prisma from "@/lib/prisma";
import { expectError, expectSuccess } from "../utils/assertion-helpers";
import {
	createTestCase,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * QA G3 adversarial suite for "TEA — Batch endpoint does not verify element
 * ownership against the case" (branch fix/batch-element-ownership).
 *
 * Written independently of barret's tests in
 * case-batch-update-service.test.ts (same directory) — only reads them
 * afterwards to avoid duplicating coverage. Does not modify that file.
 */

vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));

describe("batch ownership — adversarial (QA G3)", () => {
	/**
	 * CRITICAL FINDING: `validateElementOwnership` builds `createdIds` from
	 * every `elementId` appearing in the batch's `create` changes, then
	 * excludes any id in `createdIds` from the ownership lookup — including
	 * for `delete` changes that happen to reuse the same id
	 * (case-batch-update-service.ts, `addIfExisting` applied to
	 * `deletes[].elementId`).
	 *
	 * A batch that pairs `{type: "delete", elementId: X}` with
	 * `{type: "create", elementId: X, ...}` for the SAME id X therefore
	 * skips the ownership check for the delete entirely, even when X is a
	 * real row belonging to a different case. `applyDeletes` runs before
	 * `applyCreates` (see the apply order comment in `applyBatchUpdate`), so
	 * if this is accepted the foreign row is hard-deleted by primary key
	 * (Prisma `delete({ where: { id } })` does not filter by caseId) and then
	 * recreated under the attacker's own case with attacker-controlled data
	 * — a cross-case delete-and-hijack that the ownership gate was supposed
	 * to prevent.
	 */
	it("rejects a batch that deletes a foreign element and recreates the same id (delete+recreate id-reuse exploit)", async () => {
		const attacker = await createTestUser();
		const victim = await createTestUser();
		const attackerCase = await createTestCase(attacker.id);
		const victimCase = await createTestCase(victim.id);
		const victimElement = await createTestElement(victimCase.id, victim.id, {
			elementType: "GOAL",
			name: "Victim's Goal",
		});

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		const changes: ElementChange[] = [
			{ type: "delete", elementId: victimElement.id },
			{
				type: "create",
				elementId: victimElement.id,
				parentId: null,
				data: {
					id: victimElement.id,
					type: "GOAL",
					name: "Hijacked by attacker",
					description: "Recreated under attacker's case",
					inSandbox: false,
				},
			},
		];

		expectError(await applyBatchUpdate(attacker.id, attackerCase.id, changes));

		const stillVictims = await prisma.assuranceElement.findUnique({
			where: { id: victimElement.id },
		});
		expect(stillVictims).not.toBeNull();
		expect(stillVictims?.caseId).toBe(victimCase.id);
		expect(stillVictims?.name).toBe("Victim's Goal");
	});

	it("rejects a mixed batch where only ONE of several changes references a foreign element (atomicity)", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);
		const otherCase = await createTestCase(user.id);
		const legalElementA = await createTestElement(testCase.id, user.id, {
			elementType: "GOAL",
			name: "Legal A",
		});
		const legalElementB = await createTestElement(testCase.id, user.id, {
			elementType: "GOAL",
			name: "Legal B",
		});
		const foreignElement = await createTestElement(otherCase.id, user.id, {
			elementType: "GOAL",
		});

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		const changes: ElementChange[] = [
			{
				type: "update",
				elementId: legalElementA.id,
				data: { name: "Legal A Renamed" },
			},
			{
				type: "update",
				elementId: legalElementB.id,
				data: { name: "Legal B Renamed" },
			},
			{
				// buried in the middle of an otherwise entirely legal batch
				type: "update",
				elementId: foreignElement.id,
				data: { name: "Hijacked" },
			},
		];

		expectError(await applyBatchUpdate(user.id, testCase.id, changes));

		const a = await prisma.assuranceElement.findUnique({
			where: { id: legalElementA.id },
		});
		const b = await prisma.assuranceElement.findUnique({
			where: { id: legalElementB.id },
		});
		expect(a?.name).toBe("Legal A");
		expect(b?.name).toBe("Legal B");
	});

	it("rejects link_evidence when claimId is a batch-created id but evidenceId is foreign", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);
		const otherCase = await createTestCase(user.id);
		const foreignEvidence = await createTestElement(otherCase.id, user.id, {
			elementType: "EVIDENCE",
		});

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		const newClaimId = `element-created-claim-${Date.now()}`;
		const changes: ElementChange[] = [
			{
				type: "create",
				elementId: newClaimId,
				parentId: null,
				data: {
					id: newClaimId,
					type: "PROPERTY_CLAIM",
					name: "Batch-created claim",
					description: "Created in the same batch as the link",
					inSandbox: false,
				},
			},
			{
				type: "link_evidence",
				evidenceId: foreignEvidence.id,
				claimId: newClaimId,
			},
		];

		expectError(await applyBatchUpdate(user.id, testCase.id, changes));

		const created = await prisma.assuranceElement.findUnique({
			where: { id: newClaimId },
		});
		expect(created).toBeNull();

		const link = await prisma.evidenceLink.findFirst({
			where: { evidenceId: foreignEvidence.id, claimId: newClaimId },
		});
		expect(link).toBeNull();
	});

	it("rejects a create chain (create-under-create) whose outer parent is foreign", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);
		const otherCase = await createTestCase(user.id);
		const foreignParent = await createTestElement(otherCase.id, user.id, {
			elementType: "GOAL",
		});

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		const middleId = `element-chain-middle-${Date.now()}`;
		const leafId = `element-chain-leaf-${Date.now()}`;
		const changes: ElementChange[] = [
			{
				type: "create",
				elementId: middleId,
				parentId: foreignParent.id,
				data: {
					id: middleId,
					type: "PROPERTY_CLAIM",
					name: "Middle (parented to a foreign element)",
					description: "Should be rejected",
					inSandbox: false,
				},
			},
			{
				type: "create",
				elementId: leafId,
				parentId: middleId,
				data: {
					id: leafId,
					type: "STRATEGY",
					name: "Leaf (parented to the middle create)",
					description: "Should never be reached",
					inSandbox: false,
				},
			},
		];

		expectError(await applyBatchUpdate(user.id, testCase.id, changes));

		const middle = await prisma.assuranceElement.findUnique({
			where: { id: middleId },
		});
		const leaf = await prisma.assuranceElement.findUnique({
			where: { id: leafId },
		});
		expect(middle).toBeNull();
		expect(leaf).toBeNull();
	});

	/**
	 * `calculateLevelFromParentChain`'s transparent-strategy hop is pinned by
	 * barret's tests for batch CREATES ("transparent-strategy grandparent
	 * hop (batch creates)") but not for a batch UPDATE that MOVES an
	 * existing property claim under a strategy. Both `applyCreates` and
	 * `applyUpdates` are meant to share the same rule — this pins that the
	 * move path actually does.
	 */
	it("computes the correct level when a batch UPDATE moves a property claim under a STRATEGY whose parent is a PROPERTY_CLAIM", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);
		const goal = await createTestElement(testCase.id, user.id, {
			elementType: "GOAL",
		});
		const grandparent = await createTestElement(testCase.id, user.id, {
			elementType: "PROPERTY_CLAIM",
			parentId: goal.id,
		});
		await prisma.assuranceElement.update({
			where: { id: grandparent.id },
			data: { level: 1 },
		});
		const strategy = await createTestElement(testCase.id, user.id, {
			elementType: "STRATEGY",
			parentId: grandparent.id,
		});
		// The claim being moved starts out unrelated (top-level, level 1) so a
		// wrong "leave it alone" implementation can't accidentally pass.
		const mover = await createTestElement(testCase.id, user.id, {
			elementType: "PROPERTY_CLAIM",
		});
		await prisma.assuranceElement.update({
			where: { id: mover.id },
			data: { level: 1 },
		});

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		const changes: ElementChange[] = [
			{
				type: "update",
				elementId: mover.id,
				data: { parentId: strategy.id },
			},
		];

		expectSuccess(await applyBatchUpdate(user.id, testCase.id, changes));

		const moved = await prisma.assuranceElement.findUnique({
			where: { id: mover.id },
		});
		expect(moved?.parentId).toBe(strategy.id);
		// grandparent.level (1) + 1 = 2, skipping the transparent strategy —
		// same rule the single-element route and batch creates use.
		expect(moved?.level).toBe(2);
	});

	it("rejects a batch referencing a soft-deleted element that belongs to a different case", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);
		const otherCase = await createTestCase(user.id);
		const foreignSoftDeleted = await createTestElement(otherCase.id, user.id, {
			elementType: "GOAL",
		});
		await prisma.assuranceElement.update({
			where: { id: foreignSoftDeleted.id },
			data: { deletedAt: new Date() },
		});

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		const changes: ElementChange[] = [
			{
				type: "update",
				elementId: foreignSoftDeleted.id,
				data: { name: "Hijacked soft-deleted element" },
			},
		];

		expectError(await applyBatchUpdate(user.id, testCase.id, changes));
	});
});
