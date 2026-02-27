import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
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

		const result = await createCaseStudy(owner.id, {
			title: "My Case Study",
			description: "An in-depth study",
		});

		expect(result.id).toBeDefined();
		expect(result.title).toBe("My Case Study");
		expect(result.description).toBe("An in-depth study");
	});

	it("sets the ownerId to the creating user", async () => {
		const owner = await createTestUser();
		const { createCaseStudy } = await import(
			"@/lib/services/case-study-service"
		);

		const result = await createCaseStudy(owner.id, {
			title: "Owner Test Case Study",
		});

		expect(result.ownerId).toBe(owner.id);
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

		const created = await createCaseStudy(owner.id, {
			title: "Original Title",
			description: "Original description",
		});

		const updated = await updateCaseStudy(created.id, owner.id, {
			title: "Updated Title",
			description: "Updated description",
		});

		expect(updated).not.toBeNull();
		expect(updated?.title).toBe("Updated Title");
		expect(updated?.description).toBe("Updated description");
	});

	it("returns null when updated by a non-owner", async () => {
		const owner = await createTestUser();
		const other = await createTestUser();
		const { createCaseStudy, updateCaseStudy } = await import(
			"@/lib/services/case-study-service"
		);

		const created = await createCaseStudy(owner.id, {
			title: "Should Not Update",
		});

		const result = await updateCaseStudy(created.id, other.id, {
			title: "Hijacked Title",
		});

		expect(result).toBeNull();

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
	it("deletes a case study owned by the user and returns true", async () => {
		const owner = await createTestUser();
		const { createCaseStudy, deleteCaseStudy } = await import(
			"@/lib/services/case-study-service"
		);

		const created = await createCaseStudy(owner.id, {
			title: "To Delete",
		});

		const result = await deleteCaseStudy(created.id, owner.id);

		expect(result).toBe(true);

		const deleted = await prisma.caseStudy.findUnique({
			where: { id: created.id },
		});
		expect(deleted).toBeNull();
	});

	it("returns false when deleted by a non-owner", async () => {
		const owner = await createTestUser();
		const other = await createTestUser();
		const { createCaseStudy, deleteCaseStudy } = await import(
			"@/lib/services/case-study-service"
		);

		const created = await createCaseStudy(owner.id, {
			title: "Should Survive",
		});

		const result = await deleteCaseStudy(created.id, other.id);

		expect(result).toBe(false);

		const stillExists = await prisma.caseStudy.findUnique({
			where: { id: created.id },
		});
		expect(stillExists).not.toBeNull();
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

		const results = await getCaseStudiesByOwner(owner.id);

		expect(results.length).toBe(2);
		const titles = results.map((r) => r.title);
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

		const results = await getPublishedCaseStudies();

		const titles = results.map((r) => r.title);
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

		const created = await createCaseStudy(owner.id, { title: "Findable Study" });

		const result = await getCaseStudyById(created.id);

		expect(result).not.toBeNull();
		expect(result?.id).toBe(created.id);
		expect(result?.title).toBe("Findable Study");
	});

	it("returns null for a non-existent ID", async () => {
		const { getCaseStudyById } = await import(
			"@/lib/services/case-study-service"
		);

		const result = await getCaseStudyById(999999);

		expect(result).toBeNull();
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

		const created = await createCaseStudy(owner.id, {
			title: "Public Study",
			published: true,
		});

		const result = await getPublishedCaseStudyById(created.id);

		expect(result).not.toBeNull();
		expect(result?.title).toBe("Public Study");
	});

	it("returns null for an unpublished case study", async () => {
		const owner = await createTestUser();
		const { createCaseStudy, getPublishedCaseStudyById } = await import(
			"@/lib/services/case-study-service"
		);

		const created = await createCaseStudy(owner.id, {
			title: "Private Study",
			published: false,
		});

		const result = await getPublishedCaseStudyById(created.id);

		expect(result).toBeNull();
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

		const created = await createCaseStudy(owner.id, {
			title: "Unpublished",
			published: false,
		});

		expect(created.publishedDate).toBeNull();

		const updated = await updateCaseStudy(created.id, owner.id, {
			published: true,
		});

		expect(updated).not.toBeNull();
		expect(updated?.publishedDate).not.toBeNull();
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

		const result = await createCaseStudyWithLinks(
			owner.id,
			{ title: "Linked Study" },
			[]
		);

		expect(result.id).toBeDefined();
		expect(result.title).toBe("Linked Study");
		expect(result.publishedCases).toHaveLength(0);
	});
});
