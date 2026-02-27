import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import {
	createTestCase,
	createTestComment,
	createTestElement,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

// ============================================
// exportCase
// ============================================

describe("exportCase", () => {
	it("exports a case owned by the user and returns nested JSON", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const goal = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
			name: "Root Goal",
			description: "Top-level goal",
			role: "TOP_LEVEL",
		});

		const { exportCase } = await import("@/lib/services/case-export-service");
		const result = await exportCase(owner.id, testCase.id);

		expect("data" in result).toBe(true);
		if (!("data" in result)) return;

		expect(result.data.version).toBe("1.0");
		expect(result.data.case.name).toBe(testCase.name);
		expect(result.data.tree).toBeDefined();
		expect(result.data.tree.type).toBe("GOAL");
		expect(result.data.tree.id).toBe(goal.id);
	});

	it("exports a case for a user with VIEW permission", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
			name: "Goal",
			description: "A goal",
			role: "TOP_LEVEL",
		});
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

		const { exportCase } = await import("@/lib/services/case-export-service");
		const result = await exportCase(viewer.id, testCase.id);

		expect("data" in result).toBe(true);
		if (!("data" in result)) return;
		expect(result.data.case.name).toBe(testCase.name);
	});

	it("returns Permission denied for a user without access", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
			name: "Goal",
			description: "A goal",
		});

		const { exportCase } = await import("@/lib/services/case-export-service");
		const result = await exportCase(stranger.id, testCase.id);

		expect("error" in result).toBe(true);
		if (!("error" in result)) return;
		expect(result.error).toBe("Permission denied");
	});

	it("returns Permission denied for a non-existent case (prevents enumeration)", async () => {
		const user = await createTestUser();
		const fakeId = "99999999-0000-0000-0000-000000000001";

		const { exportCase } = await import("@/lib/services/case-export-service");
		const result = await exportCase(user.id, fakeId);

		expect("error" in result).toBe(true);
		if (!("error" in result)) return;
		// Should return the same permission-denied error
		expect(result.error).toBe("Permission denied");
	});

	it("returns an error when the case has no elements", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		// No elements created

		const { exportCase } = await import("@/lib/services/case-export-service");
		const result = await exportCase(owner.id, testCase.id);

		expect("error" in result).toBe(true);
		if (!("error" in result)) return;
		expect(result.error).toBe("Case has no elements to export");
	});

	it("exports nested goal → strategy → evidence hierarchy", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);

		const goal = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
			name: "Root Goal",
			description: "Top-level goal",
			role: "TOP_LEVEL",
		});

		const strategy = await createTestElement(testCase.id, owner.id, {
			elementType: "STRATEGY",
			name: "Strategy",
			description: "A strategy",
			parentId: goal.id,
		});

		const claim = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "Claim",
			description: "A claim",
			parentId: strategy.id,
		});

		const evidence = await createTestElement(testCase.id, owner.id, {
			elementType: "EVIDENCE",
			name: "Evidence",
			description: "Supporting evidence",
		});

		// Link evidence to claim
		await prisma.evidenceLink.create({
			data: { evidenceId: evidence.id, claimId: claim.id },
		});

		const { exportCase } = await import("@/lib/services/case-export-service");
		const result = await exportCase(owner.id, testCase.id);

		expect("data" in result).toBe(true);
		if (!("data" in result)) return;

		const tree = result.data.tree;
		expect(tree.type).toBe("GOAL");
		expect(tree.children.length).toBeGreaterThanOrEqual(1);

		const strategyNode = tree.children.find((c) => c.type === "STRATEGY");
		expect(strategyNode).toBeDefined();
	});

	it("includes comment data when includeComments is true (default)", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const goal = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
			name: "Goal",
			description: "A goal",
			role: "TOP_LEVEL",
		});

		// Create a comment on the element
		await createTestComment(owner.id, {
			elementId: goal.id,
			content: "Important comment",
		});

		const { exportCase } = await import("@/lib/services/case-export-service");
		const result = await exportCase(owner.id, testCase.id, {
			includeComments: true,
		});

		expect("data" in result).toBe(true);
		if (!("data" in result)) return;

		const rootNode = result.data.tree;
		expect(rootNode.comments).toBeDefined();
		expect(rootNode.comments?.length).toBeGreaterThanOrEqual(1);
		expect(rootNode.comments?.[0].content).toBe("Important comment");
	});

	it("excludes comment data when includeComments is false", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const goal = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
			name: "Goal",
			description: "A goal",
			role: "TOP_LEVEL",
		});

		await createTestComment(owner.id, {
			elementId: goal.id,
			content: "Should not appear",
		});

		const { exportCase } = await import("@/lib/services/case-export-service");
		const result = await exportCase(owner.id, testCase.id, {
			includeComments: false,
		});

		expect("data" in result).toBe(true);
		if (!("data" in result)) return;

		const rootNode = result.data.tree;
		// Comments should be undefined when not requested
		expect(rootNode.comments).toBeUndefined();
	});
});
