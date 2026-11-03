import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
	publishAssuranceCase,
	removePublishedCopies,
} from "@/lib/services/publish-service";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCaseInformation,
	createTestCaseWithGoal,
	createTestUser,
} from "../utils/prisma-factories";
import { holdRowLock, waitForLockWait } from "../utils/row-lock-test-utils";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

beforeEach(async () => {
	await mockNoAuth();
});

function patchStatusRequest(
	caseId: string,
	targetStatus: "DRAFT" | "PUBLISHED"
) {
	return new NextRequest(`http://localhost:3000/api/cases/${caseId}/status`, {
		method: "PATCH",
		body: JSON.stringify({ targetStatus }),
		headers: { "Content-Type": "application/json" },
	});
}

// ============================================
// PATCH /api/cases/[id]/status — PUBLISHED -> PUBLISHED (republish)
// ============================================
//
// Republish must re-run the same case-information completeness gate as
// first publish (ADR 0003 §4 — lead adjudication, 2026-08-11): otherwise a
// previously-complete published record could regress via an edit that
// clears a required field, then a republish.

// ============================================
// PATCH /api/cases/[id]/status — DRAFT -> PUBLISHED (first publish, raw API)
// ============================================
//
// QA finding, 2026-08-11: this route used to run the completeness gate only
// `if (isRepublish)`, so a direct PATCH to this route (bypassing the
// dedicated `POST /api/cases/[id]/publish` route the guided UI flow uses)
// could first-publish an incomplete case with no gate at all.

describe("PATCH /api/cases/[id]/status — first-publish completeness gate (raw API)", () => {
	it("cannot publish a DRAFT case directly via PATCH when case information is incomplete", async () => {
		const user = await createTestUser();
		const testCase = await createTestCaseWithGoal(user.id);
		// No case information record at all — every required field missing.
		await mockAuth(user.id, user.username, user.email);

		const { PATCH } = await import("@/app/api/cases/[id]/status/route");
		const response = await PATCH(patchStatusRequest(testCase.id, "PUBLISHED"), {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.code).toBe("VALIDATION");
		expect(body.fieldErrors).toStrictEqual({
			description: "Description is required before publishing",
			authors: "Authors is required before publishing",
			sector: "Sector is required before publishing",
		});

		// No snapshot was created — the gate must block before the write.
		const snapshot = await prisma.publishedAssuranceCase.findFirst({
			where: { assuranceCaseId: testCase.id },
		});
		expect(snapshot).toBeNull();

		// The case remains DRAFT.
		const updated = await prisma.assuranceCase.findUnique({
			where: { id: testCase.id },
		});
		expect(updated?.publishStatus).toBe("DRAFT");
	});
});

describe("PATCH /api/cases/[id]/status — republish completeness gate", () => {
	it("cannot republish when case information is incomplete", async () => {
		const user = await createTestUser();
		const testCase = await createTestCaseWithGoal(user.id);
		await createTestCaseInformation(testCase.id, {
			description: "Complete enough for first publish",
		});
		await mockAuth(user.id, user.username, user.email);

		const { POST } = await import("@/app/api/cases/[id]/publish/route");
		const publishResponse = await POST(
			new NextRequest(
				`http://localhost:3000/api/cases/${testCase.id}/publish`,
				{ method: "POST" }
			),
			{ params: Promise.resolve({ id: testCase.id }) }
		);
		expect(publishResponse.status).toBe(200);
		const { published_id: firstPublishedId } = await publishResponse.json();

		// Case information regresses to incomplete after first publish (e.g.
		// authors cleared in a later edit).
		await prisma.caseInformation.update({
			where: { caseId: testCase.id },
			data: { authors: "" },
		});

		const { PATCH } = await import("@/app/api/cases/[id]/status/route");
		const response = await PATCH(patchStatusRequest(testCase.id, "PUBLISHED"), {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.code).toBe("VALIDATION");
		expect(body.fieldErrors).toStrictEqual({
			authors: "Authors is required before publishing",
		});

		// No new snapshot was created — the published version is unchanged.
		const current = await prisma.publishedAssuranceCase.findFirst({
			where: { assuranceCaseId: testCase.id, isCurrent: true },
		});
		expect(current?.id).toBe(firstPublishedId);
	});

	it("republishes when case information is complete", async () => {
		const user = await createTestUser();
		const testCase = await createTestCaseWithGoal(user.id);
		await createTestCaseInformation(testCase.id, {
			description: "Complete for first publish",
		});
		await mockAuth(user.id, user.username, user.email);

		const { POST } = await import("@/app/api/cases/[id]/publish/route");
		const publishResponse = await POST(
			new NextRequest(
				`http://localhost:3000/api/cases/${testCase.id}/publish`,
				{ method: "POST" }
			),
			{ params: Promise.resolve({ id: testCase.id }) }
		);
		expect(publishResponse.status).toBe(200);
		const { published_id: firstPublishedId } = await publishResponse.json();

		const { PATCH } = await import("@/app/api/cases/[id]/status/route");
		const response = await PATCH(patchStatusRequest(testCase.id, "PUBLISHED"), {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.success).toBe(true);
		expect(body.newStatus).toBe("PUBLISHED");
		expect(body.publishedId).toBeDefined();
		expect(body.publishedId).not.toBe(firstPublishedId);

		// A fresh snapshot is now current.
		const current = await prisma.publishedAssuranceCase.findFirst({
			where: { assuranceCaseId: testCase.id, isCurrent: true },
		});
		expect(current?.id).toBe(body.publishedId);
	});

	it("three-field gate: missing sector alone blocks republish", async () => {
		const user = await createTestUser();
		const testCase = await createTestCaseWithGoal(user.id);
		await createTestCaseInformation(testCase.id, {
			description: "Complete for first publish",
		});
		await mockAuth(user.id, user.username, user.email);

		const { POST } = await import("@/app/api/cases/[id]/publish/route");
		const publishResponse = await POST(
			new NextRequest(
				`http://localhost:3000/api/cases/${testCase.id}/publish`,
				{ method: "POST" }
			),
			{ params: Promise.resolve({ id: testCase.id }) }
		);
		expect(publishResponse.status).toBe(200);

		await prisma.caseInformation.update({
			where: { caseId: testCase.id },
			data: { sector: "" },
		});

		const { PATCH } = await import("@/app/api/cases/[id]/status/route");
		const response = await PATCH(patchStatusRequest(testCase.id, "PUBLISHED"), {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.fieldErrors).toStrictEqual({
			sector: "Sector is required before publishing",
		});
	});
});

describe("PATCH /api/cases/[id]/status — republish refused when the case changed", () => {
	it("answers 409 CONFLICT and writes nothing when the case was unpublished after the snapshot was composed", async () => {
		const user = await createTestUser();
		const testCase = await createTestCaseWithGoal(user.id);
		await createTestCaseInformation(testCase.id, {
			description: "Complete for first publish",
		});
		expectSuccess(await publishAssuranceCase(user.id, testCase.id));
		await mockAuth(user.id, user.username, user.email);

		// An unpublish that has not yet committed holds the case row, so the
		// republish reads the case as still published and then waits for the
		// row before writing.
		const holder = await holdRowLock(async (tx) => {
			await removePublishedCopies(tx, [testCase.id]);
		});
		const { PATCH } = await import("@/app/api/cases/[id]/status/route");
		const pending = PATCH(patchStatusRequest(testCase.id, "PUBLISHED"), {
			params: Promise.resolve({ id: testCase.id }),
		});
		await waitForLockWait();
		await holder.release();
		const response = await pending;

		expect(response.status).toBe(409);
		expect(await response.json()).toMatchObject({
			code: "CONFLICT",
			error: "The case changed while it was being published. Try again.",
		});
		expect(
			await prisma.publishedAssuranceCase.count({
				where: { assuranceCaseId: testCase.id },
			})
		).toBe(0);
		const after = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: testCase.id },
			select: { published: true, publishStatus: true },
		});
		expect(after).toEqual({ published: false, publishStatus: "DRAFT" });
	});
});
