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

		expect("data" in result).toBe(true);
		if (!("data" in result)) {
			return;
		}
		expect(result.data.id).toBeDefined();
		expect(result.data.title).toBe("My Case Study");
		expect(result.data.description).toBe("An in-depth study");
	});

	it("sets the ownerId to the creating user", async () => {
		const owner = await createTestUser();
		const { createCaseStudy } = await import(
			"@/lib/services/case-study-service"
		);

		const result = await createCaseStudy(owner.id, {
			title: "Owner Test Case Study",
		});

		expect("data" in result).toBe(true);
		if (!("data" in result)) {
			return;
		}
		expect(result.data.ownerId).toBe(owner.id);
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

		expect("data" in created).toBe(true);
		if (!("data" in created)) {
			return;
		}

		const updated = await updateCaseStudy(created.data.id, owner.id, {
			title: "Updated Title",
			description: "Updated description",
		});

		expect("data" in updated).toBe(true);
		if (!("data" in updated)) {
			return;
		}
		expect(updated.data.title).toBe("Updated Title");
		expect(updated.data.description).toBe("Updated description");
	});

	it("returns error when updated by a non-owner", async () => {
		const owner = await createTestUser();
		const other = await createTestUser();
		const { createCaseStudy, updateCaseStudy } = await import(
			"@/lib/services/case-study-service"
		);

		const created = await createCaseStudy(owner.id, {
			title: "Should Not Update",
		});

		expect("data" in created).toBe(true);
		if (!("data" in created)) {
			return;
		}

		const result = await updateCaseStudy(created.data.id, other.id, {
			title: "Hijacked Title",
		});

		expect("error" in result).toBe(true);

		// Verify DB was not changed
		const unchanged = await prisma.caseStudy.findUnique({
			where: { id: created.data.id },
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

		const created = await createCaseStudy(owner.id, {
			title: "To Delete",
		});

		expect("data" in created).toBe(true);
		if (!("data" in created)) {
			return;
		}

		const result = await deleteCaseStudy(created.data.id, owner.id);

		expect("data" in result).toBe(true);

		const deleted = await prisma.caseStudy.findUnique({
			where: { id: created.data.id },
		});
		expect(deleted).toBeNull();
	});

	it("returns error when deleted by a non-owner", async () => {
		const owner = await createTestUser();
		const other = await createTestUser();
		const { createCaseStudy, deleteCaseStudy } = await import(
			"@/lib/services/case-study-service"
		);

		const created = await createCaseStudy(owner.id, {
			title: "Should Survive",
		});

		expect("data" in created).toBe(true);
		if (!("data" in created)) {
			return;
		}

		const result = await deleteCaseStudy(created.data.id, other.id);

		expect("error" in result).toBe(true);

		const stillExists = await prisma.caseStudy.findUnique({
			where: { id: created.data.id },
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

		expect("data" in results).toBe(true);
		if (!("data" in results)) {
			return;
		}
		expect(results.data.length).toBe(2);
		const titles = results.data.map((r: { title: string }) => r.title);
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

		expect("data" in results).toBe(true);
		if (!("data" in results)) {
			return;
		}
		const titles = results.data.map((r: { title: string }) => r.title);
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

		const created = await createCaseStudy(owner.id, {
			title: "Findable Study",
		});

		expect("data" in created).toBe(true);
		if (!("data" in created)) {
			return;
		}

		const result = await getCaseStudyById(created.data.id, owner.id);

		expect("data" in result).toBe(true);
		if (!("data" in result)) {
			return;
		}
		expect(result.data.id).toBe(created.data.id);
		expect(result.data.title).toBe("Findable Study");
	});

	it("returns error for a non-existent ID", async () => {
		const owner = await createTestUser();
		const { getCaseStudyById } = await import(
			"@/lib/services/case-study-service"
		);

		const result = await getCaseStudyById(999_999, owner.id);

		expect("error" in result).toBe(true);
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

		expect("data" in created).toBe(true);
		if (!("data" in created)) {
			return;
		}

		const result = await getPublishedCaseStudyById(created.data.id);

		expect("data" in result).toBe(true);
		if (!("data" in result)) {
			return;
		}
		expect(result.data.title).toBe("Public Study");
	});

	it("returns error for an unpublished case study", async () => {
		const owner = await createTestUser();
		const { createCaseStudy, getPublishedCaseStudyById } = await import(
			"@/lib/services/case-study-service"
		);

		const created = await createCaseStudy(owner.id, {
			title: "Private Study",
			published: false,
		});

		expect("data" in created).toBe(true);
		if (!("data" in created)) {
			return;
		}

		const result = await getPublishedCaseStudyById(created.data.id);

		expect("error" in result).toBe(true);
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

		expect("data" in created).toBe(true);
		if (!("data" in created)) {
			return;
		}
		expect(created.data.publishedDate).toBeNull();

		const updated = await updateCaseStudy(created.data.id, owner.id, {
			published: true,
		});

		expect("data" in updated).toBe(true);
		if (!("data" in updated)) {
			return;
		}
		expect(updated.data.publishedDate).not.toBeNull();
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

		expect("data" in result).toBe(true);
		if (!("data" in result)) {
			return;
		}
		expect(result.data.id).toBeDefined();
		expect(result.data.title).toBe("Linked Study");
		expect(result.data.publishedCases).toHaveLength(0);
	});
});
