import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { createTestUser } from "../utils/prisma-factories";

// ============================================
// Helpers
// ============================================

/** Minimal valid nested-format case JSON for testing. */
function makeNestedCase(overrides: Record<string, unknown> = {}) {
	return {
		version: "1.0",
		exportedAt: new Date().toISOString(),
		case: {
			name: "Test Import Case",
			description: "A case created for import testing",
		},
		tree: {
			id: "00000000-0000-0000-0000-000000000001",
			type: "GOAL",
			name: "Top-level Goal",
			description: "The root goal",
			inSandbox: false,
			role: "TOP_LEVEL",
			children: [],
		},
		...overrides,
	};
}

/** Nested case with a goal → strategy → property_claim chain. */
function makeNestedCaseWithChain() {
	return {
		version: "1.0",
		exportedAt: new Date().toISOString(),
		case: {
			name: "Chained Case",
			description: "Case with strategy chain",
		},
		tree: {
			id: "10000000-0000-0000-0000-000000000001",
			type: "GOAL",
			name: "Root Goal",
			description: "Top-level goal",
			inSandbox: false,
			role: "TOP_LEVEL",
			children: [
				{
					id: "10000000-0000-0000-0000-000000000002",
					type: "STRATEGY",
					name: "Strategy 1",
					description: "A strategy",
					inSandbox: false,
					children: [
						{
							id: "10000000-0000-0000-0000-000000000003",
							type: "PROPERTY_CLAIM",
							name: "Claim 1",
							description: "A property claim",
							inSandbox: false,
							children: [
								{
									id: "10000000-0000-0000-0000-000000000004",
									type: "EVIDENCE",
									name: "Evidence 1",
									description: "Supporting evidence",
									inSandbox: false,
									url: "https://example.com/evidence",
									children: [],
								},
							],
						},
					],
				},
			],
		},
	};
}

// ============================================
// importCase
// ============================================

describe("importCase", () => {
	it("imports a valid nested case and returns caseId and name", async () => {
		const user = await createTestUser();
		const { importCase } = await import("@/lib/services/case-import-service");

		const json = makeNestedCase();
		const result = await importCase(user.id, json);

		expect("data" in result).toBe(true);
		if (!("data" in result)) {
			return;
		}
		expect(result.data.caseId).toBeDefined();
		expect(result.data.caseName).toBe("Test Import Case");
	});

	it("imported case is owned by the importing user", async () => {
		const user = await createTestUser();
		const { importCase } = await import("@/lib/services/case-import-service");

		const json = makeNestedCase();
		const result = await importCase(user.id, json);

		expect("data" in result).toBe(true);
		if (!("data" in result)) {
			return;
		}

		const createdCase = await prisma.assuranceCase.findUnique({
			where: { id: result.data.caseId },
		});
		expect(createdCase).not.toBeNull();
		expect(createdCase?.createdById).toBe(user.id);
	});

	it("imports goal → strategy → property_claim chain preserving hierarchy", async () => {
		const user = await createTestUser();
		const { importCase } = await import("@/lib/services/case-import-service");

		const json = makeNestedCaseWithChain();
		const result = await importCase(user.id, json);

		expect("data" in result).toBe(true);
		if (!("data" in result)) {
			return;
		}

		const elements = await prisma.assuranceElement.findMany({
			where: { caseId: result.data.caseId },
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

		const json = makeNestedCaseWithChain();
		const result = await importCase(user.id, json);

		expect("data" in result).toBe(true);
		if (!("data" in result)) {
			return;
		}

		// Chain has: goal, strategy, claim, evidence = 4 elements
		expect(result.data.elementCount).toBe(4);
	});

	it("creates evidence links for evidence attached to a claim", async () => {
		const user = await createTestUser();
		const { importCase } = await import("@/lib/services/case-import-service");

		const json = makeNestedCaseWithChain();
		const result = await importCase(user.id, json);

		expect("data" in result).toBe(true);
		if (!("data" in result)) {
			return;
		}

		expect(result.data.evidenceLinkCount).toBeGreaterThanOrEqual(1);

		const links = await prisma.evidenceLink.findMany();
		expect(links.length).toBeGreaterThanOrEqual(1);
	});

	it("returns an error for null/empty JSON input", async () => {
		const user = await createTestUser();
		const { importCase } = await import("@/lib/services/case-import-service");

		const result = await importCase(user.id, null);

		expect("error" in result).toBe(true);
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

		const result = await importCase(user.id, json);

		expect("error" in result).toBe(true);
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

		const json = makeNestedCase();
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

		const json = makeNestedCaseWithChain();
		const result = await validateImportData(json);

		expect(result.isValid).toBe(true);
		// Goal, Strategy, PropertyClaim, Evidence = 4
		expect(result.elementCount).toBe(4);
	});

	it("round-trip: import then re-export produces equivalent structure", async () => {
		const user = await createTestUser();
		const { importCase } = await import("@/lib/services/case-import-service");
		const { exportCase } = await import("@/lib/services/case-export-service");

		const json = makeNestedCaseWithChain();
		const importResult = await importCase(user.id, json);

		expect("data" in importResult).toBe(true);
		if (!("data" in importResult)) {
			return;
		}

		const exportResult = await exportCase(user.id, importResult.data.caseId);

		expect("data" in exportResult).toBe(true);
		if (!("data" in exportResult)) {
			return;
		}

		expect(exportResult.data.case.name).toBe("Chained Case");

		// Root tree node should be the goal
		expect(exportResult.data.tree.type).toBe("GOAL");
		// Should have at least the strategy as a child
		expect(exportResult.data.tree.children.length).toBeGreaterThanOrEqual(1);
	});
});
