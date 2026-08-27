import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
	attachElement,
	createElement,
	detachElement,
	updateElement,
} from "@/lib/services/element-service";
import {
	expectError,
	expectSameError,
	expectSuccess,
} from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * QA G3 adversarial suite for "TEA — Element-service reference integrity"
 * (branch fix/element-service-reference-integrity, commit 9894783c).
 *
 * Written independently of barret's tests (element-defeats-scoping.test.ts,
 * api-elements-defeats-element-id.test.ts, element-citation-integrity.test.ts)
 * — read only afterwards to avoid duplicating coverage. Does not modify
 * those files.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));

beforeEach(async () => {
	await mockNoAuth();
});

const NOT_FOUND_PATTERN =
	/defeatsElementId must reference an existing element in this case/;
const PARENT_NOT_FOUND_PATTERN = /Parent element not found/;

describe("defeatsElementId — anti-enumeration (cross-case vs nonexistent give the SAME message)", () => {
	it("HTTP create: cross-case and nonexistent ids produce byte-identical error bodies", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const otherCase = await createTestCase(owner.id);
		const foreignTarget = await createTestElement(otherCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import("@/app/api/cases/[id]/elements/route");

		const crossCaseReq = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/elements`,
			{
				method: "POST",
				body: JSON.stringify({
					type: "property_claim",
					name: "Cross-case attempt",
					defeatsElementId: foreignTarget.id,
				}),
				headers: { "Content-Type": "application/json" },
			}
		);
		const crossCaseRes = await POST(crossCaseReq, {
			params: Promise.resolve({ id: testCase.id }),
		});
		const crossCaseBody = await crossCaseRes.json();

		const nonexistentReq = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/elements`,
			{
				method: "POST",
				body: JSON.stringify({
					type: "property_claim",
					name: "Nonexistent attempt",
					defeatsElementId: "00000000-0000-0000-0000-000000000000",
				}),
				headers: { "Content-Type": "application/json" },
			}
		);
		const nonexistentRes = await POST(nonexistentReq, {
			params: Promise.resolve({ id: testCase.id }),
		});
		const nonexistentBody = await nonexistentRes.json();

		expect(crossCaseRes.status).toBe(400);
		expect(nonexistentRes.status).toBe(400);
		expect(crossCaseBody.error).toBe(nonexistentBody.error);
	});

	it("service layer: cross-case and nonexistent defeatsElementId are the SAME error on create", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const otherCase = await createTestCase(owner.id);
		const foreignTarget = await createTestElement(otherCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
		});

		const crossCaseResult = await createElement(owner.id, {
			caseId: testCase.id,
			elementType: "property_claim",
			defeatsElementId: foreignTarget.id,
		});
		const nonexistentResult = await createElement(owner.id, {
			caseId: testCase.id,
			elementType: "property_claim",
			defeatsElementId: "00000000-0000-0000-0000-000000000000",
		});

		expectSameError(crossCaseResult, nonexistentResult);
	});
});

describe("defeatsElementId — cases barret's suite didn't cover", () => {
	it("rejects a soft-deleted same-case target on UPDATE (barret only pinned this on create)", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const target = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
		});
		await prisma.assuranceElement.update({
			where: { id: target.id },
			data: { deletedAt: new Date(), deletedById: owner.id },
		});
		const element = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
		});

		const result = await updateElement(owner.id, element.id, {
			defeatsElementId: target.id,
		});
		expectError(result, NOT_FOUND_PATTERN);

		const inDb = await prisma.assuranceElement.findUnique({
			where: { id: element.id },
		});
		expect(inDb?.defeatsElementId).toBeNull();
	});

	it("omitting defeatsElementId on update leaves the existing value unchanged", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const target = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
		});
		const element = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
			defeatsElementId: target.id,
			isDefeater: true,
		});

		// Update an unrelated field only — defeatsElementId is not in the input.
		const data = expectSuccess(
			await updateElement(owner.id, element.id, {
				name: "Renamed, defeatsElementId untouched",
			})
		);
		expect(data.defeatsElementId).toBe(target.id);

		const inDb = await prisma.assuranceElement.findUnique({
			where: { id: element.id },
		});
		expect(inDb?.defeatsElementId).toBe(target.id);
		expect(inDb?.isDefeater).toBe(true);
	});
});

describe("parentId same-case scoping — EVIDENCE path specifically", () => {
	it("rejects a cross-case parentId when creating an EVIDENCE element (EvidenceLink path, not just direct parentId)", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const otherCase = await createTestCase(owner.id);
		const foreignClaim = await createTestElement(otherCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
		});

		const result = await createElement(owner.id, {
			caseId: testCase.id,
			elementType: "evidence",
			parentId: foreignClaim.id,
		});
		expectError(result, PARENT_NOT_FOUND_PATTERN);

		// No element created in the target case...
		const elements = await prisma.assuranceElement.findMany({
			where: { caseId: testCase.id },
		});
		expect(elements).toHaveLength(0);

		// ...and, critically, no EvidenceLink was created against the foreign
		// claim either (the vulnerable path pre-fix would have written the
		// AssuranceElement row and then created the EvidenceLink regardless
		// of case membership).
		const links = await prisma.evidenceLink.findMany({
			where: { claimId: foreignClaim.id },
		});
		expect(links).toHaveLength(0);
	});

	it("accepts a same-case parentId when creating an EVIDENCE element and creates the EvidenceLink", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const claim = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
		});

		const data = expectSuccess(
			await createElement(owner.id, {
				caseId: testCase.id,
				elementType: "evidence",
				parentId: claim.id,
			})
		);

		const link = await prisma.evidenceLink.findFirst({
			where: { claimId: claim.id, evidenceId: data.id },
		});
		expect(link).not.toBeNull();
	});

	it("rejects a cross-case parentId for EVIDENCE through the HTTP route", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const otherCase = await createTestCase(owner.id);
		const foreignClaim = await createTestElement(otherCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import("@/app/api/cases/[id]/elements/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/elements`,
			{
				method: "POST",
				body: JSON.stringify({
					type: "evidence",
					name: "Cross-case evidence",
					propertyClaimId: foreignClaim.id,
				}),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		// Unlike defeatsElementId/citedElementId/moduleReferenceId (structured
		// "<field> ..." messages explicitly mapped to 400 in
		// lib/api-response.ts), "Parent element not found" matches the
		// generic "not found" -> 404 mapping — consistent with
		// updateElement's pre-existing new-parent check ("Element not
		// found", also 404). Not a bug: same shape as the sibling check,
		// just a different status code family. See QA note in the G3 return.
		expect(response.status).toBe(404);
		const body = await response.json();
		expect(body.error).toMatch(PARENT_NOT_FOUND_PATTERN);

		const links = await prisma.evidenceLink.findMany({
			where: { claimId: foreignClaim.id },
		});
		expect(links).toHaveLength(0);
	});
});

describe("detachElement — descendant citation sweep, two levels deep", () => {
	it("nullifies a citation to a GRANDCHILD (depth 2), not just an immediate child", async () => {
		const owner = await createTestUser();
		const homeCase = await createTestCase(owner.id);
		const awayCase = await createTestCase(owner.id);
		const root = await createTestElement(awayCase.id, owner.id, {
			elementType: "GOAL",
		});
		const child = await createTestElement(awayCase.id, owner.id, {
			elementType: "STRATEGY",
			parentId: root.id,
		});
		const grandchild = await createTestElement(awayCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
			parentId: child.id,
		});
		const citer = await createTestElement(homeCase.id, owner.id, {
			elementType: "AWAY_GOAL",
			moduleReferenceId: awayCase.id,
			citedElementId: grandchild.id,
		});

		// A citation to a sibling subtree — must survive the detach untouched.
		const otherRoot = await createTestElement(awayCase.id, owner.id, {
			elementType: "STRATEGY",
		});
		const otherLeaf = await createTestElement(awayCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
			parentId: otherRoot.id,
		});
		const siblingCiter = await createTestElement(homeCase.id, owner.id, {
			elementType: "AWAY_GOAL",
			moduleReferenceId: awayCase.id,
			citedElementId: otherLeaf.id,
		});

		expectSuccess(await detachElement(owner.id, root.id));

		const citerAfter = await prisma.assuranceElement.findUnique({
			where: { id: citer.id },
		});
		expect(citerAfter?.citedElementId).toBeNull();
		expect(citerAfter?.citationDangling).toBe(true);

		const siblingCiterAfter = await prisma.assuranceElement.findUnique({
			where: { id: siblingCiter.id },
		});
		expect(siblingCiterAfter?.citedElementId).toBe(otherLeaf.id);
		expect(siblingCiterAfter?.citationDangling).toBe(false);
	});
});

describe("detach + re-attach does not silently re-heal (regression guard, mirrors ADR 0004 D5)", () => {
	it("re-attaching a detached element with descendants leaves ALL swept citations dangling", async () => {
		const owner = await createTestUser();
		const homeCase = await createTestCase(owner.id);
		const awayCase = await createTestCase(owner.id);
		const root = await createTestElement(awayCase.id, owner.id, {
			elementType: "GOAL",
		});
		const child = await createTestElement(awayCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
			parentId: root.id,
		});
		const citerOfRoot = await createTestElement(homeCase.id, owner.id, {
			elementType: "AWAY_GOAL",
			moduleReferenceId: awayCase.id,
			citedElementId: root.id,
		});
		const citerOfChild = await createTestElement(homeCase.id, owner.id, {
			elementType: "AWAY_GOAL",
			moduleReferenceId: awayCase.id,
			citedElementId: child.id,
		});
		// Detach needs a parent to detach FROM in the sense of moving to
		// sandbox; root has no parent, which is fine — detachElement clears
		// parentId and sets inSandbox regardless.
		const grandparent = await createTestElement(awayCase.id, owner.id, {
			elementType: "GOAL",
		});
		await prisma.assuranceElement.update({
			where: { id: root.id },
			data: { parentId: grandparent.id },
		});

		expectSuccess(await detachElement(owner.id, root.id));

		expectSuccess(await attachElement(owner.id, root.id, grandparent.id));

		const rootCiterAfter = await prisma.assuranceElement.findUnique({
			where: { id: citerOfRoot.id },
		});
		const childCiterAfter = await prisma.assuranceElement.findUnique({
			where: { id: citerOfChild.id },
		});
		expect(rootCiterAfter?.citedElementId).toBeNull();
		expect(rootCiterAfter?.citationDangling).toBe(true);
		expect(childCiterAfter?.citedElementId).toBeNull();
		expect(childCiterAfter?.citationDangling).toBe(true);
	});
});

describe("id-reuse-class bypass check (style of batch-ownership-adversarial.test.ts)", () => {
	/**
	 * The batch endpoint's bug (TEA — Batch endpoint does not verify element
	 * ownership against the case) worked because a client-controlled
	 * `elementId` appearing in the SAME batch's `create` changes was
	 * excluded from the ownership lookup, letting a `delete` for that same
	 * id slip past the check on a real foreign row.
	 *
	 * That exploit needs two ingredients neither of which exist on the
	 * single-element create/update paths touched by this change:
	 *   1. A client-supplied `id` for a new row (createElementInDatabase's
	 *      `prisma.assuranceElement.create` never accepts one — Prisma/the
	 *      schema generates it), so there is no id for an attacker to
	 *      collide with a victim's row.
	 *   2. Multiple operations sharing one id-collection pass. The batch bug
	 *      lived in `validateElementOwnership`'s `createdIds` exclusion set,
	 *      built once across a whole batch; createElement/updateElement each
	 *      validate a single defeatsElementId/parentId against `caseId`
	 *      directly, with no equivalent "ids I'm about to create" allowlist
	 *      to smuggle a foreign id through.
	 *
	 * This test is the closest reachable analogue: prove that validating
	 * defeatsElementId against a target created moments earlier IN THE SAME
	 * TEST (i.e. no batching, no id reuse) still enforces case scoping
	 * correctly when the target and the referencing element are created in
	 * rapid succession — a sequential-request approximation of the
	 * interleaving the batch bug exploited.
	 */
	it("validates defeatsElementId against the target's actual case even when both elements are created back-to-back", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const otherCase = await createTestCase(owner.id);

		const foreignTarget = await createTestElement(otherCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
		});
		// Immediately attempt to reference it from testCase, no delay.
		const result = await createElement(owner.id, {
			caseId: testCase.id,
			elementType: "property_claim",
			defeatsElementId: foreignTarget.id,
		});
		expectError(result, NOT_FOUND_PATTERN);
	});

	it("confirms createElementInDatabase never accepts a client-supplied id (the precondition the batch exploit needed)", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const victim = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
			name: "Victim",
		});

		// Attempt to smuggle an `id` field through createElement's input —
		// even if a caller tried to collide with an existing row's id, the
		// service does not forward `id` into the create call.
		const result = await createElement(owner.id, {
			caseId: testCase.id,
			elementType: "strategy",
			// @ts-expect-error — id is not part of CreateElementInput; this is
			// exactly the adversarial payload shape to probe for.
			id: victim.id,
			name: "Attempted collision",
		});

		expectSuccess(result);
		const stillVictim = await prisma.assuranceElement.findUnique({
			where: { id: victim.id },
		});
		expect(stillVictim?.name).toBe("Victim");
	});
});
