import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	addTeamMember,
	createTestCase,
	createTestElement,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

/**
 * Permission matrix for the two server actions behind the "Add away goal" /
 * "Add module" picker (ADR 0005 D7): own case, shared VIEW, shared EDIT, no
 * access, non-existent case.
 */

beforeEach(async () => {
	await mockNoAuth();
});

describe("listCitableCases (actions/cited-element-picker.ts)", () => {
	it("returns Unauthorised when not signed in", async () => {
		const { listCitableCases } = await import("@/actions/cited-element-picker");
		const result = await listCitableCases();
		expect(result).toMatchObject({ success: false, error: "Unauthorised" });
	});

	it("includes the user's own case", async () => {
		const owner = await createTestUser();
		const ownCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email ?? undefined);

		const { listCitableCases } = await import("@/actions/cited-element-picker");
		const result = await listCitableCases();

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.map((c) => c.id)).toContain(ownCase.id);
		}
	});

	it("includes a case shared with the user (VIEW) EXACTLY ONCE", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const sharedCase = await createTestCase(owner.id);
		await createTestPermission(sharedCase.id, viewer.id, owner.id, "VIEW");
		await mockAuth(viewer.id, viewer.username, viewer.email ?? undefined);

		const { listCitableCases } = await import("@/actions/cited-element-picker");
		const result = await listCitableCases();

		expect(result.success).toBe(true);
		if (result.success) {
			const matches = result.data.filter((c) => c.id === sharedCase.id);
			expect(matches).toHaveLength(1);
		}
	});

	it("includes a case shared with the user (EDIT) EXACTLY ONCE", async () => {
		const owner = await createTestUser();
		const editor = await createTestUser();
		const sharedCase = await createTestCase(owner.id);
		await createTestPermission(sharedCase.id, editor.id, owner.id, "EDIT");
		await mockAuth(editor.id, editor.username, editor.email ?? undefined);

		const { listCitableCases } = await import("@/actions/cited-element-picker");
		const result = await listCitableCases();

		expect(result.success).toBe(true);
		if (result.success) {
			const matches = result.data.filter((c) => c.id === sharedCase.id);
			expect(matches).toHaveLength(1);
		}
	});

	it("includes a case shared with the user's team EXACTLY ONCE (regression: was listed twice — TEA — Away-goal case picker lists a directly-shared case twice)", async () => {
		const owner = await createTestUser();
		const member = await createTestUser();
		const team = await createTestTeam(owner.id);
		await addTeamMember(team.id, member.id, "MEMBER", owner.id);
		const teamCase = await createTestCase(owner.id);
		await createTestTeamPermission(teamCase.id, team.id, owner.id, "VIEW");
		await mockAuth(member.id, member.username, member.email ?? undefined);

		const { listCitableCases } = await import("@/actions/cited-element-picker");
		const result = await listCitableCases();

		expect(result.success).toBe(true);
		if (result.success) {
			const matches = result.data.filter((c) => c.id === teamCase.id);
			expect(matches).toHaveLength(1);
		}
	});

	it("a directly-shared case does not also appear via listSharedCases (regression: TEA — Away-goal case picker lists a directly-shared case twice)", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const sharedCase = await createTestCase(owner.id);
		await createTestPermission(sharedCase.id, viewer.id, owner.id, "VIEW");
		await mockAuth(viewer.id, viewer.username, viewer.email ?? undefined);

		const { listCitableCases } = await import("@/actions/cited-element-picker");
		const result = await listCitableCases();

		expect(result.success).toBe(true);
		if (result.success) {
			const ids = result.data.map((c) => c.id);
			expect(ids.filter((id) => id === sharedCase.id)).toHaveLength(1);
		}
	});

	it("excludes a case the user has no access to", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const privateCase = await createTestCase(owner.id);
		await mockAuth(stranger.id, stranger.username, stranger.email ?? undefined);

		const { listCitableCases } = await import("@/actions/cited-element-picker");
		const result = await listCitableCases();

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.map((c) => c.id)).not.toContain(privateCase.id);
		}
	});
});

describe("listCitableGoals (actions/cited-element-picker.ts)", () => {
	it("returns Unauthorised when not signed in", async () => {
		const { listCitableGoals } = await import("@/actions/cited-element-picker");
		const result = await listCitableGoals(
			"00000000-0000-0000-0000-000000000000"
		);
		expect(result).toMatchObject({ success: false, error: "Unauthorised" });
	});

	it("returns Invalid case ID for a malformed id", async () => {
		const owner = await createTestUser();
		await mockAuth(owner.id, owner.username, owner.email ?? undefined);

		const { listCitableGoals } = await import("@/actions/cited-element-picker");
		const result = await listCitableGoals("not-a-uuid");

		expect(result).toMatchObject({ success: false, error: "Invalid case ID" });
	});

	it("returns Permission denied for a non-existent case", async () => {
		const owner = await createTestUser();
		await mockAuth(owner.id, owner.username, owner.email ?? undefined);

		const { listCitableGoals } = await import("@/actions/cited-element-picker");
		const result = await listCitableGoals(
			"00000000-0000-0000-0000-000000000000"
		);

		expect(result).toMatchObject({
			success: false,
			error: "Permission denied",
		});
	});

	it("returns the goals of the user's own case", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const goal = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
			name: "G1",
		});
		await mockAuth(owner.id, owner.username, owner.email ?? undefined);

		const { listCitableGoals } = await import("@/actions/cited-element-picker");
		const result = await listCitableGoals(testCase.id);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.map((g) => g.id)).toContain(goal.id);
		}
	});

	it("never returns goals from a different case (the picker cannot itself produce a cross-case citation)", async () => {
		const owner = await createTestUser();
		const caseA = await createTestCase(owner.id);
		const caseB = await createTestCase(owner.id);
		const goalInA = await createTestElement(caseA.id, owner.id, {
			elementType: "GOAL",
			name: "G1",
		});
		await createTestElement(caseB.id, owner.id, {
			elementType: "GOAL",
			name: "G1",
		});
		await mockAuth(owner.id, owner.username, owner.email ?? undefined);

		const { listCitableGoals } = await import("@/actions/cited-element-picker");
		const result = await listCitableGoals(caseA.id);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.map((g) => g.id)).toEqual([goalInA.id]);
		}
	});

	it("returns the goals of a case shared with the user (VIEW)", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const goal = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
			name: "G1",
		});
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await mockAuth(viewer.id, viewer.username, viewer.email ?? undefined);

		const { listCitableGoals } = await import("@/actions/cited-element-picker");
		const result = await listCitableGoals(testCase.id);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.map((g) => g.id)).toContain(goal.id);
		}
	});

	it("returns the goals of a case shared with the user (EDIT)", async () => {
		const owner = await createTestUser();
		const editor = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const goal = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
			name: "G1",
		});
		await createTestPermission(testCase.id, editor.id, owner.id, "EDIT");
		await mockAuth(editor.id, editor.username, editor.email ?? undefined);

		const { listCitableGoals } = await import("@/actions/cited-element-picker");
		const result = await listCitableGoals(testCase.id);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.map((g) => g.id)).toContain(goal.id);
		}
	});

	it("denies access to a case the user has no permission on", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(stranger.id, stranger.username, stranger.email ?? undefined);

		const { listCitableGoals } = await import("@/actions/cited-element-picker");
		const result = await listCitableGoals(testCase.id);

		expect(result).toMatchObject({
			success: false,
			error: "Permission denied",
		});
	});
});
