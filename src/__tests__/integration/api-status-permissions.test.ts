import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	addTeamMember,
	createTestCaseInformation,
	createTestCaseWithGoal,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

beforeEach(async () => {
	await mockNoAuth();
});

const NON_EXISTENT_CASE_ID = "00000000-0000-0000-0000-000000000000";

function patchStatusRequest(caseId: string) {
	return new NextRequest(`http://localhost:3000/api/cases/${caseId}/status`, {
		method: "PATCH",
		body: JSON.stringify({ targetStatus: "PUBLISHED" }),
		headers: { "Content-Type": "application/json" },
	});
}

async function callPatchStatus(caseId: string) {
	const { PATCH } = await import("@/app/api/cases/[id]/status/route");
	return await PATCH(patchStatusRequest(caseId), {
		params: Promise.resolve({ id: caseId }),
	});
}

/**
 * Full permission matrix for PATCH /api/cases/[id]/status — this route only
 * had completeness-gate coverage (`api-status.test.ts`), not access-control
 * coverage (repo convention: every secured endpoint gets the full matrix,
 * see CLAUDE.md "Testing"). All cases below carry complete case information
 * (`createTestCaseInformation`'s defaults) so every attempt clears the
 * completeness gate in `route.ts`. The VIEW/COMMENT-refused cells prove the
 * EDIT-or-higher check in `transitionStatus` -> `publishAssuranceCase`
 * (`publish-service.ts`); the no-permission and non-existent-case cells are
 * refused earlier, by the VIEW check inside `requireCaseInformationComplete`
 * -> `getCaseInformation`, which runs before `transitionStatus` for any
 * PUBLISHED target.
 */
describe("PATCH /api/cases/[id]/status — permission matrix", () => {
	it("owner can transition the case", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		await createTestCaseInformation(testCase.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await callPatchStatus(testCase.id);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.newStatus).toBe("PUBLISHED");
	});

	it("a direct EDIT share can transition the case", async () => {
		const owner = await createTestUser();
		const editor = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		await createTestCaseInformation(testCase.id);
		await createTestPermission(testCase.id, editor.id, owner.id, "EDIT");
		await mockAuth(editor.id, editor.username, editor.email);

		const response = await callPatchStatus(testCase.id);

		expect(response.status).toBe(200);
	});

	it("a direct ADMIN share can transition the case", async () => {
		const owner = await createTestUser();
		const admin = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		await createTestCaseInformation(testCase.id);
		await createTestPermission(testCase.id, admin.id, owner.id, "ADMIN");
		await mockAuth(admin.id, admin.username, admin.email);

		const response = await callPatchStatus(testCase.id);

		expect(response.status).toBe(200);
	});

	it("EDIT via team can transition the case", async () => {
		const owner = await createTestUser();
		const teamMember = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		await createTestCaseInformation(testCase.id);
		const team = await createTestTeam(owner.id);
		await addTeamMember(team.id, teamMember.id);
		await createTestTeamPermission(testCase.id, team.id, owner.id, "EDIT");
		await mockAuth(teamMember.id, teamMember.username, teamMember.email);

		const response = await callPatchStatus(testCase.id);

		expect(response.status).toBe(200);
	});

	it("ADMIN via team can transition the case", async () => {
		const owner = await createTestUser();
		const teamMember = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		await createTestCaseInformation(testCase.id);
		const team = await createTestTeam(owner.id);
		await addTeamMember(team.id, teamMember.id);
		await createTestTeamPermission(testCase.id, team.id, owner.id, "ADMIN");
		await mockAuth(teamMember.id, teamMember.username, teamMember.email);

		const response = await callPatchStatus(testCase.id);

		expect(response.status).toBe(200);
	});

	it("a direct VIEW share is refused (EDIT required)", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		await createTestCaseInformation(testCase.id);
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await mockAuth(viewer.id, viewer.username, viewer.email);

		const response = await callPatchStatus(testCase.id);

		expect(response.status).toBe(403);
		const body = await response.json();
		expect(body.code).toBe("FORBIDDEN");
		expect(body.error).toBe("Permission denied");
	});

	it("a direct COMMENT share is refused (EDIT required)", async () => {
		const owner = await createTestUser();
		const commenter = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		await createTestCaseInformation(testCase.id);
		await createTestPermission(testCase.id, commenter.id, owner.id, "COMMENT");
		await mockAuth(commenter.id, commenter.username, commenter.email);

		const response = await callPatchStatus(testCase.id);

		expect(response.status).toBe(403);
		const body = await response.json();
		expect(body.code).toBe("FORBIDDEN");
		expect(body.error).toBe("Permission denied");
	});

	it("VIEW via team is refused (EDIT required)", async () => {
		const owner = await createTestUser();
		const teamMember = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		await createTestCaseInformation(testCase.id);
		const team = await createTestTeam(owner.id);
		await addTeamMember(team.id, teamMember.id);
		await createTestTeamPermission(testCase.id, team.id, owner.id, "VIEW");
		await mockAuth(teamMember.id, teamMember.username, teamMember.email);

		const response = await callPatchStatus(testCase.id);

		expect(response.status).toBe(403);
		const body = await response.json();
		expect(body.code).toBe("FORBIDDEN");
		expect(body.error).toBe("Permission denied");
	});

	it("COMMENT via team is refused (EDIT required)", async () => {
		const owner = await createTestUser();
		const teamMember = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		await createTestCaseInformation(testCase.id);
		const team = await createTestTeam(owner.id);
		await addTeamMember(team.id, teamMember.id);
		await createTestTeamPermission(testCase.id, team.id, owner.id, "COMMENT");
		await mockAuth(teamMember.id, teamMember.username, teamMember.email);

		const response = await callPatchStatus(testCase.id);

		expect(response.status).toBe(403);
		const body = await response.json();
		expect(body.code).toBe("FORBIDDEN");
		expect(body.error).toBe("Permission denied");
	});

	it("a user with no permission on the case is refused", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		await createTestCaseInformation(testCase.id);
		await mockAuth(stranger.id, stranger.username, stranger.email);

		const response = await callPatchStatus(testCase.id);

		expect(response.status).toBe(403);
		const body = await response.json();
		expect(body.code).toBe("FORBIDDEN");
		expect(body.error).toBe("Permission denied");
	});

	it("an unauthenticated request is refused with 401", async () => {
		await mockNoAuth();

		const response = await callPatchStatus(NON_EXISTENT_CASE_ID);

		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body.code).toBe("UNAUTHORISED");
	});

	it("a non-existent case returns the same status and error as no-permission (anti-enumeration)", async () => {
		const stranger = await createTestUser();
		await mockAuth(stranger.id, stranger.username, stranger.email);

		const response = await callPatchStatus(NON_EXISTENT_CASE_ID);

		expect(response.status).toBe(403);
		const body = await response.json();
		expect(body.code).toBe("FORBIDDEN");
		expect(body.error).toBe("Permission denied");
	});
});
