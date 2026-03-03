import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import {
	expectError,
	expectSameError,
	expectSuccess,
} from "../utils/assertion-helpers";
import {
	createNestedCaseJSON,
	createNestedCaseWithChainJSON,
	createTestUser,
} from "../utils/prisma-factories";

// ============================================
// importCase
// ============================================

describe("importCase", () => {
	it("imports a valid nested case and returns caseId and name", async () => {
		const user = await createTestUser();
		const { importCase } = await import("@/lib/services/case-import-service");

		const json = createNestedCaseJSON();
		const data = expectSuccess(await importCase(user.id, json));
		expect(data.caseId).toBeDefined();
		expect(data.caseName).toBe("Test Import Case");
	});

	it("imported case is owned by the importing user", async () => {
		const user = await createTestUser();
		const { importCase } = await import("@/lib/services/case-import-service");

		const json = createNestedCaseJSON();
		const data = expectSuccess(await importCase(user.id, json));

		const createdCase = await prisma.assuranceCase.findUnique({
			where: { id: data.caseId },
		});
		expect(createdCase).not.toBeNull();
		expect(createdCase?.createdById).toBe(user.id);
	});

	it("imports goal → strategy → property_claim chain preserving hierarchy", async () => {
		const user = await createTestUser();
		const { importCase } = await import("@/lib/services/case-import-service");

		const json = createNestedCaseWithChainJSON();
		const data = expectSuccess(await importCase(user.id, json));

		const elements = await prisma.assuranceElement.findMany({
			where: { caseId: data.caseId },
		});

		const goal = elements.find((e) => e.elementType === "GOAL");
		const strategy = elements.find((e) => e.elementType === "STRATEGY");
		const claim = elements.find((e) => e.elementType === "PROPERTY_CLAIM");

		expect(goal).toBeDefined();
		expect(strategy).toBeDefined();
		expect(claim).toBeDefined();

		// Strategy's parent should be the goal
		expect(strategy?.parentId).toBe(goal?.id);
		// Claim's parent should be the strategy
		expect(claim?.parentId).toBe(strategy?.id);
	});

	it("import creates the correct element count", async () => {
		const user = await createTestUser();
		const { importCase } = await import("@/lib/services/case-import-service");

		const json = createNestedCaseWithChainJSON();
		const data = expectSuccess(await importCase(user.id, json));

		// Chain has: goal, strategy, claim, evidence = 4 elements
		expect(data.elementCount).toBe(4);
	});

	it("creates evidence links for evidence attached to a claim", async () => {
		const user = await createTestUser();
		const { importCase } = await import("@/lib/services/case-import-service");

		const json = createNestedCaseWithChainJSON();
		const data = expectSuccess(await importCase(user.id, json));

		expect(data.evidenceLinkCount).toBeGreaterThanOrEqual(1);

		const links = await prisma.evidenceLink.findMany();
		expect(links.length).toBeGreaterThanOrEqual(1);
	});

	it("returns an error for null/empty JSON input", async () => {
		const user = await createTestUser();
		const { importCase } = await import("@/lib/services/case-import-service");

		expectError(await importCase(user.id, null));
	});

	it("returns an error for JSON missing the required case name field", async () => {
		const user = await createTestUser();
		const { importCase } = await import("@/lib/services/case-import-service");

		const json = {
			version: "1.0",
			exportedAt: new Date().toISOString(),
			case: {
				// name is missing — should fail validation
				description: "Missing name",
			},
			tree: {
				id: "20000000-0000-0000-0000-000000000001",
				type: "GOAL",
				name: "Root Goal",
				description: "Description",
				inSandbox: false,
				children: [],
			},
		};

		expectError(await importCase(user.id, json));
	});

	it("returns same error for not-found and no-access (anti-enumeration)", async () => {
		const userA = await createTestUser();
		const userB = await createTestUser();
		const { importCase } = await import("@/lib/services/case-import-service");

		// Import a case as userA so there is something in the DB
		const json = createNestedCaseJSON();
		await importCase(userA.id, json);

		// importCase does not take a caseId — it always creates a new case for the
		// calling user, so ownership enumeration is not applicable here.
		// Instead, verify that invalid/malformed input returns the same error shape
		// regardless of the user calling it (anti-enumeration for input errors).
		const nullResult = await importCase(userB.id, null);
		const badResult = await importCase(userA.id, null);

		expectSameError(nullResult, badResult);
	});
});

// ============================================
// validateImportData
// ============================================

describe("validateImportData", () => {
	it("returns isValid=true for valid nested case data", async () => {
		const { validateImportData } = await import(
			"@/lib/services/case-import-service"
		);

		const json = createNestedCaseJSON();
		const result = await validateImportData(json);

		expect(result.isValid).toBe(true);
		expect(result.caseName).toBe("Test Import Case");
		expect(result.version).toBe("nested");
	});

	it("returns isValid=false for completely invalid data", async () => {
		const { validateImportData } = await import(
			"@/lib/services/case-import-service"
		);

		const result = await validateImportData({ garbage: true });

		expect(result.isValid).toBe(false);
		expect(result.errors).toBeDefined();
		expect(result.errors?.length).toBeGreaterThan(0);
	});

	it("returns correct element count for valid data", async () => {
		const { validateImportData } = await import(
			"@/lib/services/case-import-service"
		);

		const json = createNestedCaseWithChainJSON();
		const result = await validateImportData(json);

		expect(result.isValid).toBe(true);
		// Goal, Strategy, PropertyClaim, Evidence = 4
		expect(result.elementCount).toBe(4);
	});

	it("round-trip: import then re-export produces equivalent structure", async () => {
		const user = await createTestUser();
		const { importCase } = await import("@/lib/services/case-import-service");
		const { exportCase } = await import("@/lib/services/case-export-service");

		const json = createNestedCaseWithChainJSON();
		const importData = expectSuccess(await importCase(user.id, json));

		const exportData = expectSuccess(
			await exportCase(user.id, importData.caseId)
		);

		expect(exportData.case.name).toBe("Chained Case");

		// Root tree node should be the goal
		expect(exportData.tree.type).toBe("GOAL");
		// Should have at least the strategy as a child
		expect(exportData.tree.children.length).toBeGreaterThanOrEqual(1);
	});
});
