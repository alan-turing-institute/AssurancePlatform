import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	createTestCase,
	createTestComment,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

// Reset the auth mock to null before every test so tests start unauthenticated.
beforeEach(async () => {
	await mockNoAuth();
});

// ============================================
// fetchCaseComments (actions/cases.ts)
// ============================================

describe("fetchCaseComments", () => {
	it("returns null when the user is not authenticated", async () => {
		// beforeEach already calls mockNoAuth()
		const { fetchCaseComments } = await import("@/actions/cases");
		const result = await fetchCaseComments("any-case-id");

		expect(result).toBeNull();
	});

	it("returns null for a case the user has no access to", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();

		const testCase = await createTestCase(owner.id);

		await mockAuth(stranger.id, stranger.username, stranger.email);

		const { fetchCaseComments } = await import("@/actions/cases");
		const result = await fetchCaseComments(testCase.id);

		// The action catches the notFound() thrown by comment-service and returns null
		expect(result).toBeNull();
	});

	it("returns an empty array for a case with no case-level comments (owner)", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);

		await mockAuth(owner.id, owner.username, owner.email);

		const { fetchCaseComments } = await import("@/actions/cases");
		const result = await fetchCaseComments(testCase.id);

		expect(result).not.toBeNull();
		expect(Array.isArray(result)).toBe(true);
		expect(result?.length).toBe(0);
	});

	it("returns case-level comments for the case owner", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestComment(owner.id, {
			caseId: testCase.id,
			content: "An owner note",
		});

		await mockAuth(owner.id, owner.username, owner.email);

		const { fetchCaseComments } = await import("@/actions/cases");
		const result = await fetchCaseComments(testCase.id);

		expect(result).not.toBeNull();
		const contents = result?.map((c) => c.content) ?? [];
		expect(contents).toContain("An owner note");
	});

	it("returns comments for a user with VIEW permission", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await createTestComment(owner.id, {
			caseId: testCase.id,
			content: "Visible to viewer",
		});

		await mockAuth(viewer.id, viewer.username, viewer.email);

		const { fetchCaseComments } = await import("@/actions/cases");
		const result = await fetchCaseComments(testCase.id);

		expect(result).not.toBeNull();
		const contents = result?.map((c) => c.content) ?? [];
		expect(contents).toContain("Visible to viewer");
	});
});

// ============================================
// loadStaticCaseData (actions/case-data.ts)
// ============================================

describe("loadStaticCaseData", () => {
	it("rejects a filename containing path traversal with ..", async () => {
		const { loadStaticCaseData } = await import("@/actions/case-data");
		const result = await loadStaticCaseData("../etc/passwd");

		expect("error" in result).toBe(true);
		if (!("error" in result)) return;
		expect(result.error).toBe("Invalid case file name");
	});

	it("rejects a filename containing a forward slash", async () => {
		const { loadStaticCaseData } = await import("@/actions/case-data");
		const result = await loadStaticCaseData("subdir/file.json");

		expect("error" in result).toBe(true);
		if (!("error" in result)) return;
		expect(result.error).toBe("Invalid case file name");
	});

	it("returns an error for a file that does not exist", async () => {
		const { loadStaticCaseData } = await import("@/actions/case-data");
		const result = await loadStaticCaseData("nonexistent-file-xyz.json");

		expect("error" in result).toBe(true);
		if (!("error" in result)) return;
		expect(result.error).toContain("Failed to load case data");
	});

	it("loads a valid static JSON file from public/data", async () => {
		const { loadStaticCaseData } = await import("@/actions/case-data");
		// design-reference-case.json is known to exist in public/data
		const result = await loadStaticCaseData("design-reference-case.json");

		expect("data" in result).toBe(true);
		if (!("data" in result)) return;
		expect(result.data).not.toBeNull();
	});
});
