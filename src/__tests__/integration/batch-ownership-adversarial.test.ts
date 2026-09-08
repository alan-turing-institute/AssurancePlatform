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

	/**
	 * Re-verification round (dba9edf6): confirms the delete/update
	 * "addAlways" fix holds under a slightly harder id-reuse variant — the
	 * recreate ALSO smuggles a second, DIFFERENT foreign id in as its
	 * parentId, so a fix that only special-cased the single-id
	 * delete+recreate pattern (and forgot parentId is still
	 * addUnlessSiblingCreate) would wrongly accept this.
	 */
	it("rejects delete+recreate id-reuse when the recreate's parentId ALSO reuses a second, different foreign id", async () => {
		const attacker = await createTestUser();
		const attackerCase = await createTestCase(attacker.id);
		const victimCase = await createTestCase(attacker.id);
		const victimElement = await createTestElement(victimCase.id, attacker.id, {
			elementType: "GOAL",
			name: "Victim Element",
		});
		const secondForeignParent = await createTestElement(
			victimCase.id,
			attacker.id,
			{ elementType: "GOAL", name: "Second Foreign Element" }
		);

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		const changes: ElementChange[] = [
			{ type: "delete", elementId: victimElement.id },
			{
				type: "create",
				elementId: victimElement.id,
				parentId: secondForeignParent.id,
				data: {
					id: victimElement.id,
					type: "GOAL",
					name: "Hijacked, parented under a second foreign element",
					description: "Should never be created",
					inSandbox: false,
				},
			},
		];

		expectError(await applyBatchUpdate(attacker.id, attackerCase.id, changes));

		const stillThere = await prisma.assuranceElement.findUnique({
			where: { id: victimElement.id },
		});
		expect(stillThere).not.toBeNull();
		expect(stillThere?.caseId).toBe(victimCase.id);
		expect(stillThere?.name).toBe("Victim Element");

		const secondUntouched = await prisma.assuranceElement.findUnique({
			where: { id: secondForeignParent.id },
		});
		expect(secondUntouched).not.toBeNull();
	});

	/**
	 * The `addAlways` split applies to BOTH delete's and update's own
	 * elementId. This pins the update side specifically: a batch that both
	 * updates a foreign element AND (elsewhere in the same batch) creates a
	 * NEW element reusing that same id must still reject — an
	 * implementation that only fixed the delete path, or that special-cased
	 * "update+create pairs" differently from "delete+create pairs", would
	 * miss this.
	 */
	it("rejects an update whose elementId is foreign even when that same id is also used by a create elsewhere in the batch", async () => {
		const attacker = await createTestUser();
		const attackerCase = await createTestCase(attacker.id);
		const victimCase = await createTestCase(attacker.id);
		const victimElement = await createTestElement(victimCase.id, attacker.id, {
			elementType: "GOAL",
			name: "Victim Element",
		});
		const otherNewId = `element-update-plus-create-${Date.now()}`;

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		const changes: ElementChange[] = [
			{
				type: "update",
				elementId: victimElement.id,
				data: { name: "Hijacked via update" },
			},
			{
				// Same id as the update target, reused by an UNRELATED create
				// elsewhere in the batch — must not exempt the update above.
				type: "create",
				elementId: victimElement.id,
				parentId: null,
				data: {
					id: victimElement.id,
					type: "GOAL",
					name: "Should never be created (duplicate id)",
					description: "id collides with the update target above",
					inSandbox: false,
				},
			},
			{
				type: "create",
				elementId: otherNewId,
				parentId: null,
				data: {
					id: otherNewId,
					type: "GOAL",
					name: "Unrelated legitimate create",
					description: "Should not be created either — whole batch rejected",
					inSandbox: false,
				},
			},
		];

		expectError(await applyBatchUpdate(attacker.id, attackerCase.id, changes));

		const unchanged = await prisma.assuranceElement.findUnique({
			where: { id: victimElement.id },
		});
		expect(unchanged?.name).toBe("Victim Element");
		expect(unchanged?.caseId).toBe(victimCase.id);

		const notCreated = await prisma.assuranceElement.findUnique({
			where: { id: otherNewId },
		});
		expect(notCreated).toBeNull();
	});

	/**
	 * Combines the delete+recreate id-reuse pattern with defeatsElementId:
	 * a sibling create's defeatsElementId points at the SAME foreign id the
	 * batch deletes and recreates. The delete's own `addAlways` check must
	 * still catch this even though defeatsElementId (addUnlessSiblingCreate)
	 * would, on its own, exempt a reference to that id once it's also a
	 * batch create target.
	 */
	it("rejects delete+recreate id-reuse even when a sibling create's defeatsElementId also points at the reused id", async () => {
		const attacker = await createTestUser();
		const attackerCase = await createTestCase(attacker.id);
		const victimCase = await createTestCase(attacker.id);
		const victimElement = await createTestElement(victimCase.id, attacker.id, {
			elementType: "PROPERTY_CLAIM",
		});

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		const defeaterId = crypto.randomUUID();
		const changes: ElementChange[] = [
			{ type: "delete", elementId: victimElement.id },
			{
				type: "create",
				elementId: victimElement.id,
				parentId: null,
				data: {
					id: victimElement.id,
					type: "PROPERTY_CLAIM",
					name: "Hijacked",
					description: "Should never be created",
					inSandbox: false,
				},
			},
			{
				type: "create",
				elementId: defeaterId,
				parentId: null,
				data: {
					id: defeaterId,
					type: "PROPERTY_CLAIM",
					name: "Defeater citing the reused id",
					description: "defeatsElementId points at the delete+recreate target",
					inSandbox: false,
					isDefeater: true,
					defeatsElementId: victimElement.id,
				},
			},
		];

		expectError(await applyBatchUpdate(attacker.id, attackerCase.id, changes));

		const stillThere = await prisma.assuranceElement.findUnique({
			where: { id: victimElement.id },
		});
		expect(stillThere).not.toBeNull();
		expect(stillThere?.caseId).toBe(victimCase.id);

		const defeaterCreated = await prisma.assuranceElement.findUnique({
			where: { id: defeaterId },
		});
		expect(defeaterCreated).toBeNull();
	});

	/**
	 * Residual-gap probe (not an exploit — documents why): `unlink_evidence`
	 * ids still use `addUnlessSiblingCreate`, so an unlink whose evidenceId
	 * equals a batch create's elementId is exempted from the ownership
	 * check even when that id is a REAL foreign row (no delete involved,
	 * unlike the fixed pattern above). If it were exploitable, an attacker
	 * could unlink a foreign evidence/claim pair by "recreating" the
	 * foreign id. It is NOT exploitable in practice: `applyUnlinkEvidence`
	 * runs first in transaction order, but `tx.assuranceElement.create`
	 * with an id that already exists always throws a unique-constraint
	 * error, which rolls back the WHOLE transaction (including the unlink
	 * that ran earlier in the same `$transaction` callback) — Prisma
	 * interactive transactions are all-or-nothing. This test pins that the
	 * net effect is still a full rejection with no persisted change, as a
	 * regression guard on that safety net rather than on the validator
	 * itself.
	 */
	it("leaves no persisted change when unlink_evidence's evidenceId is exempted via a same-id create that collides with a real foreign row", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);
		const claim = await createTestElement(testCase.id, user.id, {
			elementType: "PROPERTY_CLAIM",
		});
		const otherCase = await createTestCase(user.id);
		const foreignEvidence = await createTestElement(otherCase.id, user.id, {
			elementType: "EVIDENCE",
		});
		await prisma.evidenceLink.create({
			data: { evidenceId: foreignEvidence.id, claimId: claim.id },
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
			{
				// Reuses the foreign evidence's id as a create target WITHOUT
				// deleting it first — this "exempts" the unlink's evidenceId
				// from the ownership check, but the create itself must fail
				// (id already exists), rolling back the whole transaction.
				type: "create",
				elementId: foreignEvidence.id,
				parentId: null,
				data: {
					id: foreignEvidence.id,
					type: "EVIDENCE",
					name: "E1",
					description: "Should never persist — unique constraint + rollback",
					inSandbox: false,
				},
			},
		];

		const result = await applyBatchUpdate(user.id, testCase.id, changes);
		expect("error" in result && result.error).toBeTruthy();

		const linkStillThere = await prisma.evidenceLink.findFirst({
			where: { evidenceId: foreignEvidence.id, claimId: claim.id },
		});
		expect(linkStillThere).not.toBeNull();
	});
});
