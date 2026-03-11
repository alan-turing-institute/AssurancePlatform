import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import {
	expectError,
	expectSameError,
	expectSuccess,
} from "../utils/assertion-helpers";
import { createTestUser } from "../utils/prisma-factories";

// Note: CaseStudy uses Int IDs (autoincrement), NOT UUID.

// ============================================
// createCaseStudy
// ============================================

describe("createCaseStudy", () => {
	it("creates a case study with title and description", async () => {
		const owner = await createTestUser();
		const { createCaseStudy } = await import(
			"@/lib/services/case-study-service"
		);

		const data = expectSuccess(
			await createCaseStudy(owner.id, {
				title: "My Case Study",
				description: "An in-depth study",
			})
		);
		expect(data.id).toBeDefined();
		expect(data.title).toBe("My Case Study");
		expect(data.description).toBe("An in-depth study");
	});

	it("sets the ownerId to the creating user", async () => {
		const owner = await createTestUser();
		const { createCaseStudy } = await import(
			"@/lib/services/case-study-service"
		);

		const data = expectSuccess(
			await createCaseStudy(owner.id, {
				title: "Owner Test Case Study",
			})
		);
		expect(data.ownerId).toBe(owner.id);
	});
});

// ============================================
// updateCaseStudy
// ============================================

describe("updateCaseStudy", () => {
	it("updates the title and description of a case study owned by the user", async () => {
		const owner = await createTestUser();
		const { createCaseStudy, updateCaseStudy } = await import(
			"@/lib/services/case-study-service"
		);

		const created = expectSuccess(
			await createCaseStudy(owner.id, {
				title: "Original Title",
				description: "Original description",
			})
		);

		const updated = expectSuccess(
			await updateCaseStudy(created.id, owner.id, {
				title: "Updated Title",
				description: "Updated description",
			})
		);
		expect(updated.title).toBe("Updated Title");
		expect(updated.description).toBe("Updated description");
	});

	it("returns error when updated by a non-owner", async () => {
		const owner = await createTestUser();
		const other = await createTestUser();
		const { createCaseStudy, updateCaseStudy } = await import(
			"@/lib/services/case-study-service"
		);

		const created = expectSuccess(
			await createCaseStudy(owner.id, {
				title: "Should Not Update",
			})
		);

		expectError(
			await updateCaseStudy(created.id, other.id, {
				title: "Hijacked Title",
			})
		);

		// Verify DB was not changed
		const unchanged = await prisma.caseStudy.findUnique({
			where: { id: created.id },
		});
		expect(unchanged?.title).toBe("Should Not Update");
	});
});

// ============================================
// deleteCaseStudy
// ============================================

describe("deleteCaseStudy", () => {
	it("deletes a case study owned by the user and returns data", async () => {
		const owner = await createTestUser();
		const { createCaseStudy, deleteCaseStudy } = await import(
			"@/lib/services/case-study-service"
		);

		const created = expectSuccess(
			await createCaseStudy(owner.id, {
				title: "To Delete",
			})
		);

		expectSuccess(await deleteCaseStudy(created.id, owner.id));

		const deleted = await prisma.caseStudy.findUnique({
			where: { id: created.id },
		});
		expect(deleted).toBeNull();
	});

	it("returns error when deleted by a non-owner", async () => {
		const owner = await createTestUser();
		const other = await createTestUser();
		const { createCaseStudy, deleteCaseStudy } = await import(
			"@/lib/services/case-study-service"
		);

		const created = expectSuccess(
			await createCaseStudy(owner.id, {
				title: "Should Survive",
			})
		);

		expectError(await deleteCaseStudy(created.id, other.id));

		const stillExists = await prisma.caseStudy.findUnique({
			where: { id: created.id },
		});
		expect(stillExists).not.toBeNull();
	});
});

// ============================================
// Anti-enumeration: updateCaseStudy and deleteCaseStudy
// ============================================

describe("anti-enumeration: consistent error responses", () => {
	it("updateCaseStudy returns the same error for a non-existent case study as for one the user does not own", async () => {
		const owner = await createTestUser();
		const other = await createTestUser();
		const { createCaseStudy, updateCaseStudy } = await import(
			"@/lib/services/case-study-service"
		);

		const created = expectSuccess(
			await createCaseStudy(owner.id, {
				title: "Enumeration Test Study",
			})
		);

		// Other user tries to update a case study they do not own
		const noAccessResult = await updateCaseStudy(created.id, other.id, {
			title: "Hijacked",
		});

		// Other user tries to update a non-existent case study
		const notFoundResult = await updateCaseStudy(999_999, other.id, {
			title: "Ghost",
		});

		expectSameError(noAccessResult, notFoundResult);
	});

	it("deleteCaseStudy returns the same error for a non-existent case study as for one the user does not own", async () => {
		const owner = await createTestUser();
		const other = await createTestUser();
		const { createCaseStudy, deleteCaseStudy } = await import(
			"@/lib/services/case-study-service"
		);

		const created = expectSuccess(
			await createCaseStudy(owner.id, {
				title: "Delete Enumeration Study",
			})
		);

		// Other user tries to delete a case study they do not own
		const noAccessResult = await deleteCaseStudy(created.id, other.id);

		// Other user tries to delete a non-existent case study
		const notFoundResult = await deleteCaseStudy(999_999, other.id);

		expectSameError(noAccessResult, notFoundResult);
	});
});

// ============================================
// getCaseStudiesByOwner
// ============================================

describe("getCaseStudiesByOwner", () => {
	it("returns all case studies owned by the user", async () => {
		const owner = await createTestUser();
		const other = await createTestUser();
		const { createCaseStudy, getCaseStudiesByOwner } = await import(
			"@/lib/services/case-study-service"
		);

		await createCaseStudy(owner.id, { title: "Study A" });
		await createCaseStudy(owner.id, { title: "Study B" });
		await createCaseStudy(other.id, { title: "Other's Study" });

		const data = expectSuccess(await getCaseStudiesByOwner(owner.id));
		expect(data.length).toBe(2);
		const titles = data.map((r: { title: string }) => r.title);
		expect(titles).toContain("Study A");
		expect(titles).toContain("Study B");
		expect(titles).not.toContain("Other's Study");
	});
});

// ============================================
// getPublishedCaseStudies
// ============================================

describe("getPublishedCaseStudies", () => {
	it("returns only published case studies", async () => {
		const owner = await createTestUser();
		const { createCaseStudy, getPublishedCaseStudies } = await import(
			"@/lib/services/case-study-service"
		);

		await createCaseStudy(owner.id, { title: "Draft Study", published: false });
		await createCaseStudy(owner.id, {
			title: "Published Study",
			published: true,
		});

		const data = expectSuccess(await getPublishedCaseStudies());
		const titles = data.map((r: { title: string }) => r.title);
		expect(titles).toContain("Published Study");
		expect(titles).not.toContain("Draft Study");
	});
});

// ============================================
// getCaseStudyById
// ============================================

describe("getCaseStudyById", () => {
	it("returns the case study for a valid ID", async () => {
		const owner = await createTestUser();
		const { createCaseStudy, getCaseStudyById } = await import(
			"@/lib/services/case-study-service"
		);

		const created = expectSuccess(
			await createCaseStudy(owner.id, {
				title: "Findable Study",
			})
		);

		const data = expectSuccess(await getCaseStudyById(created.id, owner.id));
		expect(data.id).toBe(created.id);
		expect(data.title).toBe("Findable Study");
	});

	it("returns error for a non-existent ID", async () => {
		const owner = await createTestUser();
		const { getCaseStudyById } = await import(
			"@/lib/services/case-study-service"
		);

		expectError(await getCaseStudyById(999_999, owner.id));
	});
});

// ============================================
// getPublishedCaseStudyById
// ============================================

describe("getPublishedCaseStudyById", () => {
	it("returns a published case study by ID", async () => {
		const owner = await createTestUser();
		const { createCaseStudy, getPublishedCaseStudyById } = await import(
			"@/lib/services/case-study-service"
		);

		const created = expectSuccess(
			await createCaseStudy(owner.id, {
				title: "Public Study",
				published: true,
			})
		);

		const data = expectSuccess(await getPublishedCaseStudyById(created.id));
		expect(data.title).toBe("Public Study");
	});

	it("returns error for an unpublished case study", async () => {
		const owner = await createTestUser();
		const { createCaseStudy, getPublishedCaseStudyById } = await import(
			"@/lib/services/case-study-service"
		);

		const created = expectSuccess(
			await createCaseStudy(owner.id, {
				title: "Private Study",
				published: false,
			})
		);

		expectError(await getPublishedCaseStudyById(created.id));
	});
});

// ============================================
// Publishing behaviour
// ============================================

describe("publish via updateCaseStudy", () => {
	it("sets publishedDate when first published", async () => {
		const owner = await createTestUser();
		const { createCaseStudy, updateCaseStudy } = await import(
			"@/lib/services/case-study-service"
		);

		const created = expectSuccess(
			await createCaseStudy(owner.id, {
				title: "Unpublished",
				published: false,
			})
		);
		expect(created.publishedDate).toBeNull();

		const updated = expectSuccess(
			await updateCaseStudy(created.id, owner.id, {
				published: true,
			})
		);
		expect(updated.publishedDate).not.toBeNull();
	});
});

// ============================================
// createCaseStudyWithLinks
// ============================================

describe("createCaseStudyWithLinks", () => {
	it("creates a case study with no source cases when sourceCaseIds is empty", async () => {
		const owner = await createTestUser();
		const { createCaseStudyWithLinks } = await import(
			"@/lib/services/case-study-service"
		);

		const data = expectSuccess(
			await createCaseStudyWithLinks(owner.id, { title: "Linked Study" }, [])
		);
		expect(data.id).toBeDefined();
		expect(data.title).toBe("Linked Study");
		expect(data.publishedCases).toHaveLength(0);
	});
});

// ============================================
// updateCaseStudyWithLinks
// ============================================

describe("updateCaseStudyWithLinks", () => {
	it("returns error when updated by a non-owner", async () => {
		const owner = await createTestUser();
		const other = await createTestUser();
		const { createCaseStudy, updateCaseStudyWithLinks } = await import(
			"@/lib/services/case-study-service"
		);

		const created = expectSuccess(
			await createCaseStudy(owner.id, {
				title: "Original Title",
			})
		);

		const result = await updateCaseStudyWithLinks(
			created.id,
			other.id,
			{ title: "Hijacked" },
			[]
		);

		expectError(result, "Permission denied");

		// Verify DB was not changed
		const unchanged = await prisma.caseStudy.findUnique({
			where: { id: created.id },
		});
		expect(unchanged?.title).toBe("Original Title");
	});

	it("returns error for a non-existent case study", async () => {
		const owner = await createTestUser();
		const { updateCaseStudyWithLinks } = await import(
			"@/lib/services/case-study-service"
		);

		expectError(
			await updateCaseStudyWithLinks(999_999, owner.id, { title: "Ghost" }, [])
		);
	});
});
