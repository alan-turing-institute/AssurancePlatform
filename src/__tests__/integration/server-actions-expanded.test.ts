import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestCaseStudy,
	createTestElement,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

// Factory pattern prevents dotenv.config() from overwriting DATABASE_URL
vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

// revalidatePath throws when called outside the Next.js request context.
// Mock it so server actions that call revalidatePath on success don't fail.
vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
	revalidateTag: vi.fn(),
}));

// notFound() throws in Next.js; stub it so tests can verify it would be called.
vi.mock("next/navigation", () => ({
	notFound: vi.fn(() => {
		throw new Error("NEXT_NOT_FOUND");
	}),
	redirect: vi.fn((url: string) => {
		throw new Error(`NEXT_REDIRECT:${url}`);
	}),
}));

// Default to unauthenticated before every test
beforeEach(async () => {
	await mockNoAuth();
});

// ============================================
// fetchAssuranceCases (actions/assurance-cases.ts)
// ============================================

// describe.sequential ensures tests within this block run one at a time,
// preventing afterEach DB truncations from racing with concurrent test setup.
describe.sequential("fetchAssuranceCases", () => {
	it("returns null when not authenticated", async () => {
		const { fetchAssuranceCases } = await import("@/actions/assurance-cases");
		const result = await fetchAssuranceCases();

		expect(result).toBeNull();
	});

	it("returns owned cases when authenticated", async () => {
		const user = await createTestUser();
		await createTestCase(user.id, { name: "My Case" });

		await mockAuth(user.id, user.username, user.email);

		const { fetchAssuranceCases } = await import("@/actions/assurance-cases");
		const result = await fetchAssuranceCases();

		expect(result).not.toBeNull();
		const names = result?.map((c) => c.name) ?? [];
		expect(names).toContain("My Case");
	});

	it("includes cases shared with the user via direct permission", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const sharedCase = await createTestCase(owner.id, {
			name: "Shared With Me",
		});
		await createTestPermission(sharedCase.id, viewer.id, owner.id, "VIEW");

		await mockAuth(viewer.id, viewer.username, viewer.email);

		const { fetchAssuranceCases } = await import("@/actions/assurance-cases");
		const result = await fetchAssuranceCases();

		expect(result).not.toBeNull();
		const names = result?.map((c) => c.name) ?? [];
		expect(names).toContain("Shared With Me");
	});
});

// ============================================
// fetchSharedAssuranceCases (actions/assurance-cases.ts)
// ============================================

describe.sequential("fetchSharedAssuranceCases", () => {
	it("returns null when not authenticated", async () => {
		const { fetchSharedAssuranceCases } = await import(
			"@/actions/assurance-cases"
		);
		const result = await fetchSharedAssuranceCases();

		expect(result).toBeNull();
	});

	it("excludes cases owned by the user, returning only shared ones", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();

		// viewer's own case — should NOT appear in shared list
		await createTestCase(viewer.id, { name: "My Own Case" });

		// owner's case shared with viewer — SHOULD appear
		const sharedCase = await createTestCase(owner.id, {
			name: "Shared With Me",
		});
		await createTestPermission(sharedCase.id, viewer.id, owner.id, "VIEW");

		await mockAuth(viewer.id, viewer.username, viewer.email);

		const { fetchSharedAssuranceCases } = await import(
			"@/actions/assurance-cases"
		);
		const result = await fetchSharedAssuranceCases();

		expect(result).not.toBeNull();
		const names = result?.map((c) => c.name) ?? [];
		expect(names).toContain("Shared With Me");
		expect(names).not.toContain("My Own Case");
	});
});

// ============================================
// createAssuranceCase (actions/assurance-cases.ts)
// ============================================

describe.sequential("createAssuranceCase", () => {
	it("returns an invalid session error when not authenticated", async () => {
		const { createAssuranceCase } = await import("@/actions/assurance-cases");
		const result = await createAssuranceCase({
			name: "Unauthorised Case",
			description: "Should not be created",
		});

		expect(result.success).toBe(false);
		if (result.success) {
			return;
		}
		expect(result.error).toBeTruthy();
	});

	it("creates a case and returns its ID when authenticated", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { createAssuranceCase } = await import("@/actions/assurance-cases");
		const result = await createAssuranceCase({
			name: "Brand New Case",
			description: "A test case created via server action",
		});

		expect(result.success).toBe(true);
		if (!result.success) {
			return;
		}
		expect(result.data.id).toBeTruthy();

		// Verify the DB record exists
		const created = await prisma.assuranceCase.findUnique({
			where: { id: result.data.id },
		});
		expect(created).not.toBeNull();
		expect(created?.name).toBe("Brand New Case");
	});
});

// ============================================
// fetchCaseStudies (actions/case-studies.ts)
// ============================================

describe.sequential("fetchCaseStudies", () => {
	it("throws an Unauthorised error when not authenticated", async () => {
		const { fetchCaseStudies } = await import("@/actions/case-studies");

		await expect(fetchCaseStudies()).rejects.toThrow("Unauthorised");
	});

	it("returns case studies owned by the authenticated user", async () => {
		const user = await createTestUser();
		await createTestCaseStudy(user.id, { title: "My Study" });

		await mockAuth(user.id, user.username, user.email);

		const { fetchCaseStudies } = await import("@/actions/case-studies");
		const result = await fetchCaseStudies();

		expect(result).not.toBeNull();
		const titles = (result ?? []).map((s) => s.title);
		expect(titles).toContain("My Study");
	});

	it("does not return case studies owned by other users", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		await createTestCaseStudy(owner.id, { title: "Owner's Study" });

		await mockAuth(stranger.id, stranger.username, stranger.email);

		const { fetchCaseStudies } = await import("@/actions/case-studies");
		const result = await fetchCaseStudies();

		expect(result).not.toBeNull();
		const titles = (result ?? []).map((s) => s.title);
		expect(titles).not.toContain("Owner's Study");
	});
});

// ============================================
// fetchPublishedCaseStudies (actions/case-studies.ts)
// ============================================

describe.sequential("fetchPublishedCaseStudies", () => {
	it("works without authentication (public access)", async () => {
		// beforeEach already called mockNoAuth()
		const owner = await createTestUser();
		await createTestCaseStudy(owner.id, {
			title: "Public Study",
			published: true,
		});

		const { fetchPublishedCaseStudies } = await import(
			"@/actions/case-studies"
		);
		// Should not return null despite no session (public endpoint)
		const result = await fetchPublishedCaseStudies();

		expect(result).not.toBeNull();
		expect(Array.isArray(result)).toBe(true);
		const titles = (result ?? []).map((s) => s.title);
		expect(titles).toContain("Public Study");
	});

	it("does not include unpublished case studies", async () => {
		const owner = await createTestUser();
		await createTestCaseStudy(owner.id, {
			title: "Draft Study",
			published: false,
		});

		const { fetchPublishedCaseStudies } = await import(
			"@/actions/case-studies"
		);
		const result = await fetchPublishedCaseStudies();

		const titles = (result ?? []).map((s) => s.title);
		expect(titles).not.toContain("Draft Study");
	});
});

// ============================================
// deleteCaseStudy (actions/case-studies.ts)
// ============================================

describe.sequential("deleteCaseStudy", () => {
	it("returns an Unauthorised error when not authenticated", async () => {
		const owner = await createTestUser();
		const study = await createTestCaseStudy(owner.id);

		const { deleteCaseStudy } = await import("@/actions/case-studies");
		const result = await deleteCaseStudy(study.id);

		expect(result.success).toBe(false);
		if (result.success) {
			return;
		}
		expect(result.error).toBeTruthy();
	});

	it("returns an error when a non-owner attempts deletion", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const study = await createTestCaseStudy(owner.id, {
			title: "Owner's Study",
		});

		await mockAuth(stranger.id, stranger.username, stranger.email);

		const { deleteCaseStudy } = await import("@/actions/case-studies");
		const result = await deleteCaseStudy(study.id);

		expect(result.success).toBe(false);

		// Verify the study still exists
		const found = await prisma.caseStudy.findUnique({
			where: { id: study.id },
		});
		expect(found).not.toBeNull();
	});

	it("deletes the case study for the owner", async () => {
		const owner = await createTestUser();
		const study = await createTestCaseStudy(owner.id, {
			title: "Study To Delete",
		});

		await mockAuth(owner.id, owner.username, owner.email);

		const { deleteCaseStudy } = await import("@/actions/case-studies");
		const result = await deleteCaseStudy(study.id);

		expect(result.success).toBe(true);

		const found = await prisma.caseStudy.findUnique({
			where: { id: study.id },
		});
		expect(found).toBeNull();
	});
});

// ============================================
// fetchCurrentUser (actions/users.ts)
// ============================================

describe.sequential("fetchCurrentUser", () => {
	it("returns null when not authenticated", async () => {
		const { fetchCurrentUser } = await import("@/actions/users");
		const result = await fetchCurrentUser();

		expect(result).toBeNull();
	});

	it("returns the user profile when authenticated", async () => {
		const user = await createTestUser({
			firstName: "Profile",
			lastName: "User",
		});
		await mockAuth(user.id, user.username, user.email);

		const { fetchCurrentUser } = await import("@/actions/users");
		const result = await fetchCurrentUser();

		expect(result).not.toBeNull();
		expect(result?.username).toBe(user.username);
		expect(result?.email).toBe(user.email);
		expect(result?.firstName).toBe("Profile");
		expect(result?.lastName).toBe("User");
	});
});

// ============================================
// fetchCompletedTours (actions/tours.ts)
// ============================================

describe.sequential("fetchCompletedTours", () => {
	it("returns an empty array when not authenticated", async () => {
		const { fetchCompletedTours } = await import("@/actions/tours");
		const result = await fetchCompletedTours();

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("returns an empty array for a new user with no completed tours", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { fetchCompletedTours } = await import("@/actions/tours");
		const result = await fetchCompletedTours();

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});
});

// ============================================
// markTourCompleted (actions/tours.ts)
// ============================================

describe.sequential("markTourCompleted", () => {
	it("adds a valid tour ID to the user's completed tours", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { markTourCompleted } = await import("@/actions/tours");
		const result = await markTourCompleted("dashboard");

		expect(result).not.toBeNull();
		expect(result).toContain("dashboard");

		// Verify DB state
		const updated = await prisma.user.findUnique({
			where: { id: user.id },
			select: { completedTours: true },
		});
		expect(updated?.completedTours).toContain("dashboard");
	});

	it("is idempotent — calling twice does not duplicate the tour ID", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { markTourCompleted } = await import("@/actions/tours");
		await markTourCompleted("dashboard");
		const result = await markTourCompleted("dashboard");

		expect(result).not.toBeNull();
		const count = result?.filter((id) => id === "dashboard").length ?? 0;
		expect(count).toBe(1);
	});

	it("returns null for an unknown tour ID", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { markTourCompleted } = await import("@/actions/tours");
		const result = await markTourCompleted("completely-unknown-tour");

		expect(result).toBeNull();
	});

	it("returns null when not authenticated", async () => {
		const { markTourCompleted } = await import("@/actions/tours");
		const result = await markTourCompleted("dashboard");

		expect(result).toBeNull();
	});
});

// ============================================
// fetchConnectedAccounts (actions/connected-accounts.ts)
// ============================================

describe.sequential("fetchConnectedAccounts", () => {
	it("returns null when not authenticated", async () => {
		const { fetchConnectedAccounts } = await import(
			"@/actions/connected-accounts"
		);
		const result = await fetchConnectedAccounts();

		expect(result).toBeNull();
	});

	it("returns the provider connection state for a LOCAL user", async () => {
		const user = await createTestUser({
			authProvider: "LOCAL",
			passwordHash: "some-hash",
		});
		await mockAuth(user.id, user.username, user.email);

		const { fetchConnectedAccounts } = await import(
			"@/actions/connected-accounts"
		);
		const result = await fetchConnectedAccounts();

		expect(result).not.toBeNull();
		expect(result?.primaryAuthProvider).toBe("LOCAL");
		expect(result?.hasPassword).toBe(true);
		expect(result?.github.connected).toBe(false);
		expect(result?.google.connected).toBe(false);
	});
});

// ============================================
// unlinkProvider (actions/connected-accounts.ts)
// ============================================

describe.sequential("unlinkProvider", () => {
	it("cannot unlink GitHub when it is the only authentication method", async () => {
		// GitHub-only users have no password set.  The DB schema requires
		// passwordAlgorithm to be non-null, so we use a sentinel value "none"
		// to represent a user that authenticated exclusively via OAuth.
		const n = Date.now();
		const user = await prisma.user.create({
			data: {
				email: `github-only-${n}@example.com`,
				username: `githubonly-${n}`,
				passwordHash: null,
				passwordAlgorithm: "none",
				authProvider: "GITHUB",
				githubId: `gh-${n}`,
				githubUsername: "githubuser",
			},
		});
		await mockAuth(user.id, user.username, user.email);

		const { unlinkProvider } = await import("@/actions/connected-accounts");
		const result = await unlinkProvider("github");

		expect(result.success).toBe(false);
		if (result.success) {
			return;
		}
		expect(result.error).toContain("only way to sign in");
	});

	it("returns an invalid provider error for an unrecognised provider string", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { unlinkProvider } = await import("@/actions/connected-accounts");
		const result = await unlinkProvider("twitter");

		expect(result.success).toBe(false);
		if (result.success) {
			return;
		}
		expect(result.error).toBe("Invalid provider.");
	});

	it("returns an error when GitHub is not connected to the account", async () => {
		// LOCAL user with password — no GitHub attached
		const user = await createTestUser({ authProvider: "LOCAL" });
		await mockAuth(user.id, user.username, user.email);

		const { unlinkProvider } = await import("@/actions/connected-accounts");
		const result = await unlinkProvider("github");

		expect(result.success).toBe(false);
		if (result.success) {
			return;
		}
		expect(result.error).toContain("not connected");
	});
});

// ============================================
// exportCase (actions/export-case.ts)
// ============================================

describe.sequential("exportCase", () => {
	it("returns a not authenticated error when not logged in", async () => {
		const { exportCase } = await import("@/actions/export-case");
		const result = await exportCase("any-case-id");

		expect("error" in result).toBe(true);
		if (!("error" in result)) {
			return;
		}
		expect(result.error).toBe("Not authenticated");
	});

	it("delegates to the export service and returns case data when authenticated", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id, {
			name: "Exportable Case",
		});
		// The export service requires at least one GOAL element to build a tree
		await createTestElement(testCase.id, user.id, {
			elementType: "GOAL",
			name: "Root Goal",
			description: "Top-level goal for export",
			role: "TOP_LEVEL",
		});

		await mockAuth(user.id, user.username, user.email);

		const { exportCase } = await import("@/actions/export-case");
		const result = await exportCase(testCase.id);

		// Service returns { data } or { error }
		expect("data" in result).toBe(true);
		if (!("data" in result)) {
			return;
		}
		expect(result.data.case.name).toBe("Exportable Case");
	});

	it("returns an error when the user has no access to the case", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const testCase = await createTestCase(owner.id);

		await mockAuth(stranger.id, stranger.username, stranger.email);

		const { exportCase } = await import("@/actions/export-case");
		const result = await exportCase(testCase.id);

		expect("error" in result).toBe(true);
	});
});

// ============================================
// ensureUserHasDemoCase (actions/demo-case.ts)
// ============================================

describe.sequential("ensureUserHasDemoCase", () => {
	it("does nothing (returns undefined) when not authenticated", async () => {
		const { ensureUserHasDemoCase } = await import("@/actions/demo-case");
		// Should not throw
		const result = await ensureUserHasDemoCase();

		expect(result).toBeUndefined();
	});

	it("creates a demo case for a new user", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { ensureUserHasDemoCase } = await import("@/actions/demo-case");
		await ensureUserHasDemoCase();

		const demoCase = await prisma.assuranceCase.findFirst({
			where: { createdById: user.id, isDemo: true, deletedAt: null },
		});
		expect(demoCase).not.toBeNull();
	});

	it("is idempotent — calling twice creates only one demo case", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { ensureUserHasDemoCase } = await import("@/actions/demo-case");
		await ensureUserHasDemoCase();
		await ensureUserHasDemoCase();

		const demoCases = await prisma.assuranceCase.findMany({
			where: { createdById: user.id, isDemo: true, deletedAt: null },
		});
		expect(demoCases).toHaveLength(1);
	});

	it("does not create a demo case when the user has previously dismissed it", async () => {
		const user = await createTestUser();

		// Mark demo-case tour as completed (simulates prior dismissal)
		await prisma.user.update({
			where: { id: user.id },
			data: { completedTours: { push: "demo-case" } },
		});

		await mockAuth(user.id, user.username, user.email);

		const { ensureUserHasDemoCase } = await import("@/actions/demo-case");
		await ensureUserHasDemoCase();

		const demoCase = await prisma.assuranceCase.findFirst({
			where: { createdById: user.id, isDemo: true, deletedAt: null },
		});
		expect(demoCase).toBeNull();
	});
});

// ============================================
// createCaseStudy (actions/case-studies.ts)
// ============================================

describe.sequential("createCaseStudy", () => {
	it("returns an Unauthorised error when not authenticated", async () => {
		const formData = new FormData();
		formData.append("title", "Unauthenticated Study");
		formData.append("description", "Should fail");

		const { createCaseStudy } = await import("@/actions/case-studies");
		const result = await createCaseStudy(formData);

		expect(result.success).toBe(false);
		if (result.success) {
			return;
		}
		expect(result.error).toBe("Unauthorised");
	});

	it("creates a case study from FormData when authenticated", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const formData = new FormData();
		formData.append("title", "Integration Test Study");
		formData.append("description", "Created during integration tests");

		const { createCaseStudy } = await import("@/actions/case-studies");
		const result = await createCaseStudy(formData);

		expect(result.success).toBe(true);
		if (!result.success) {
			return;
		}
		expect(result.data.title).toBe("Integration Test Study");

		// Verify DB state
		const study = await prisma.caseStudy.findFirst({
			where: { ownerId: user.id, title: "Integration Test Study" },
		});
		expect(study).not.toBeNull();
	});

	it("returns a validation error when required fields are missing from FormData", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		// FormData with no title
		const formData = new FormData();
		formData.append("description", "Missing title");

		const { createCaseStudy } = await import("@/actions/case-studies");
		const result = await createCaseStudy(formData);

		expect(result.success).toBe(false);
	});
});
