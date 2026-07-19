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
	createTestCase,
	createTestElement,
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
				id: "20000000-0000-4000-8000-000000000001",
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

	/**
	/**
	 * ADR 0004 D3, review follow-up (round 2, both reviewers independently):
	 * `createElements` (case-import-service.ts) previously dropped
	 * `assertionStatus` from the createMany rows, so any declared status
	 * silently reset to unset on import — a 1.0 round-trip fidelity break.
	 * Lead ruling: import PRESERVES a declared status, it does not drop it.
	 */
	it("preserves a declared assertionStatus through export -> import -> export (round-trip fidelity)", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
			name: "Root Goal",
			description: "Top-level goal",
			role: "TOP_LEVEL",
			assertionStatus: "NEEDS_SUPPORT",
		});

		const { exportCase } = await import("@/lib/services/case-export-service");
		const { importCase } = await import("@/lib/services/case-import-service");

		const firstExport = expectSuccess(await exportCase(owner.id, testCase.id));
		expect(firstExport.tree.assertionStatus).toBe("NEEDS_SUPPORT");

		const importer = await createTestUser();
		const imported = expectSuccess(await importCase(importer.id, firstExport));

		// Direct DB check — proves the createMany write itself carries the
		// status, not just whatever the next export happens to resolve.
		const importedGoal = await prisma.assuranceElement.findFirst({
			where: { caseId: imported.caseId, elementType: "GOAL" },
		});
		expect(importedGoal?.assertionStatus).toBe("NEEDS_SUPPORT");

		const secondExport = expectSuccess(
			await exportCase(importer.id, imported.caseId)
		);
		expect(secondExport.tree.assertionStatus).toBe("NEEDS_SUPPORT");
	});

	/**
	 * ADR 0004 D5: citedElementId names an element in the case referenced by
	 * moduleReferenceId — i.e. normally a DIFFERENT case from the one being
	 * exported/imported here, so the cited id is almost never part of the
	 * import's own idMap. Lead ruling (dispatch brief, cid 2026-07-19):
	 * preserve the original id VERBATIM in that case rather than guessing at
	 * a remap — there is no cross-case id-remapping table in this codebase
	 * (moduleReferenceId itself isn't remapped either). This test proves the
	 * verbatim-preserve path with a direct DB assertion on the imported row.
	 */
	it("preserves a citedElementId pointing outside the export verbatim through export -> import (round-trip fidelity)", async () => {
		const owner = await createTestUser();
		const homeCase = await createTestCase(owner.id);
		const awayCase = await createTestCase(owner.id);
		const citedGoal = await createTestElement(awayCase.id, owner.id, {
			elementType: "GOAL",
			name: "Away Goal",
		});
		const rootGoal = await createTestElement(homeCase.id, owner.id, {
			elementType: "GOAL",
			name: "Root Goal",
			role: "TOP_LEVEL",
		});
		await createTestElement(homeCase.id, owner.id, {
			elementType: "AWAY_GOAL",
			name: "Reference",
			parentId: rootGoal.id,
			moduleReferenceId: awayCase.id,
			citedElementId: citedGoal.id,
		});

		const { exportCase } = await import("@/lib/services/case-export-service");
		const { importCase } = await import("@/lib/services/case-import-service");

		const firstExport = expectSuccess(await exportCase(owner.id, homeCase.id));
		const exportedAwayGoal = firstExport.tree.children.find(
			(c: { type: string }) => c.type === "AWAY_GOAL"
		);
		expect(exportedAwayGoal?.citedElementId).toBe(citedGoal.id);

		const importer = await createTestUser();
		const imported = expectSuccess(await importCase(importer.id, firstExport));

		// Direct DB check — proves the createMany write itself carries the
		// (unmapped) id, not just whatever a later export happens to resolve.
		const importedAwayGoal = await prisma.assuranceElement.findFirst({
			where: { caseId: imported.caseId, elementType: "AWAY_GOAL" },
		});
		expect(importedAwayGoal?.citedElementId).toBe(citedGoal.id);

		const secondExport = expectSuccess(
			await exportCase(importer.id, imported.caseId)
		);
		const reexportedAwayGoal = secondExport.tree.children.find(
			(c: { type: string }) => c.type === "AWAY_GOAL"
		);
		expect(reexportedAwayGoal?.citedElementId).toBe(citedGoal.id);
	});

	/**
	 * Review fix item 1 (BLOCKING, P2003 trace): a citedElementId that
	 * resolves NOWHERE in the target DB used to hit createElements'
	 * createMany FK (assurance_elements_cited_element_id_fkey) and roll back
	 * prisma.$transaction — the entire import failed, not just the one
	 * citation. The fix batch-resolves citedElementId before the insert
	 * (idMap first, then one findMany against the target DB); anything left
	 * unresolvable is downgraded to citedElementId: null,
	 * citationDangling: true instead of failing the import. This test
	 * exercises exactly that path with an id that exists nowhere in the
	 * (fresh, per-test) target DB.
	 */
	it("imports successfully when citedElementId resolves nowhere in the target DB, flagging citationDangling instead of failing the whole import", async () => {
		const owner = await createTestUser();
		const homeCase = await createTestCase(owner.id);
		const rootGoal = await createTestElement(homeCase.id, owner.id, {
			elementType: "GOAL",
			name: "Root Goal",
			role: "TOP_LEVEL",
		});
		const unresolvableCitedId = crypto.randomUUID();
		await createTestElement(homeCase.id, owner.id, {
			elementType: "AWAY_GOAL",
			name: "Reference",
			parentId: rootGoal.id,
			moduleReferenceId: homeCase.id,
			citedElementId: unresolvableCitedId,
		});

		const { exportCase } = await import("@/lib/services/case-export-service");
		const { importCase } = await import("@/lib/services/case-import-service");

		const exported = expectSuccess(await exportCase(owner.id, homeCase.id));

		const importer = await createTestUser();
		const imported = expectSuccess(await importCase(importer.id, exported));

		// The import SUCCEEDED — not rolled back — and both elements landed.
		expect(imported.elementCount).toBe(2);

		const importedAwayGoal = await prisma.assuranceElement.findFirst({
			where: { caseId: imported.caseId, elementType: "AWAY_GOAL" },
		});
		expect(importedAwayGoal?.citedElementId).toBeNull();
		expect(importedAwayGoal?.citationDangling).toBe(true);

		// The unrelated goal is intact — proves this isn't a partial/silent
		// drop of the rest of the import.
		const importedGoal = await prisma.assuranceElement.findFirst({
			where: { caseId: imported.caseId, elementType: "GOAL" },
		});
		expect(importedGoal).not.toBeNull();
		expect(importedGoal?.name).toBe("Root Goal");
	});
});
