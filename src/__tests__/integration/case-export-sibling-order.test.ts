import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDocumentExportData } from "@/actions/export-document";
import { createCaseTools } from "@/lib/plugins/assistant/tools";
import prisma from "@/lib/prisma";
import type { CaseExportNested, TreeNode } from "@/lib/schemas/case-export";
import { exportCase } from "@/lib/services/case-export-service";
import { importCase } from "@/lib/services/case-import-service";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import { linkEvidence, physicalOrder } from "../utils/counter-goal-kit";
import {
	createTestCase,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * The order an export writes a parent's children in: the diagram's, whatever
 * order the database returns the rows in. Kind first (strategies and claims,
 * then evidence, then away goals), then the name in numeric order, then the id.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

beforeEach(async () => {
	await mockNoAuth();
});

const DIAGRAM_ORDER = ["P1", "P2", "P10", "S1", "E1", "E2", "AG1"];

/**
 * G1 with its children created in an order that is not the diagram's: the
 * claims P10, P2, P1, then a strategy and an away goal, with evidence E1 and
 * E2 linked to the goal E2 first.
 */
async function buildSiblings(ownerId: string) {
	const testCase = await createTestCase(ownerId);
	const otherCase = await createTestCase(ownerId);
	const caseId = testCase.id;
	const goal = await createTestElement(caseId, ownerId, {
		elementType: "GOAL",
		name: "G1",
		role: "TOP_LEVEL",
	});
	const child = (name: string, elementType: "PROPERTY_CLAIM" | "STRATEGY") =>
		createTestElement(caseId, ownerId, {
			elementType,
			name,
			parentId: goal.id,
		});
	const p10 = await child("P10", "PROPERTY_CLAIM");
	await child("P2", "PROPERTY_CLAIM");
	await child("P1", "PROPERTY_CLAIM");
	await child("S1", "STRATEGY");
	await createTestElement(caseId, ownerId, {
		elementType: "AWAY_GOAL",
		name: "AG1",
		parentId: goal.id,
		moduleReferenceId: otherCase.id,
	});
	const evidence = (name: string) =>
		createTestElement(caseId, ownerId, {
			elementType: "EVIDENCE",
			name,
			url: `https://example.com/${name}`,
		});
	const e2 = await evidence("E2");
	const e1 = await evidence("E1");
	await linkEvidence(e2.id, goal.id);
	await linkEvidence(e1.id, goal.id);
	return { caseId, goal, p10, e2, ownerId };
}

async function exported(userId: string, caseId: string) {
	return expectSuccess(await exportCase(userId, caseId));
}

const names = (node: TreeNode) => node.children.map((child) => child.name);

/** The whole tree as names, so two cases can be compared by shape. */
function outline(node: TreeNode): unknown {
	return [node.name, node.children.map(outline)];
}

describe("the order an export writes siblings in", () => {
	it("is the diagram's, whatever order the rows were created in", async () => {
		const owner = await createTestUser();
		const { caseId } = await buildSiblings(owner.id);

		const data = await exported(owner.id, caseId);

		expect(names(data.tree)).toEqual(DIAGRAM_ORDER);
	});

	it("does not change when rows are edited and so move in the table", async () => {
		const owner = await createTestUser();
		const { caseId, p10, e2 } = await buildSiblings(owner.id);
		const before = await physicalOrder(caseId);

		for (const element of [p10, e2]) {
			await prisma.assuranceElement.update({
				where: { id: element.id },
				data: { description: "edited" },
			});
		}
		const data = await exported(owner.id, caseId);

		expect(await physicalOrder(caseId)).not.toEqual(before);
		expect(names(data.tree)).toEqual(DIAGRAM_ORDER);
	});

	it("moves an element when it is renamed, as the diagram does", async () => {
		const owner = await createTestUser();
		const { caseId, p10 } = await buildSiblings(owner.id);

		await prisma.assuranceElement.update({
			where: { id: p10.id },
			data: { name: "P3" },
		});
		const data = await exported(owner.id, caseId);

		expect(names(data.tree)).toEqual([
			"P1",
			"P2",
			"P3",
			"S1",
			"E1",
			"E2",
			"AG1",
		]);
	});

	it("keeps the order through export, import and export again", async () => {
		const owner = await createTestUser();
		const { caseId } = await buildSiblings(owner.id);
		const first = await exported(owner.id, caseId);

		const imported = await importCase(
			owner.id,
			JSON.parse(JSON.stringify(first))
		);
		if (!("data" in imported)) {
			throw new Error(imported.error);
		}
		const second = await exported(owner.id, imported.data.caseId);

		expect(names(second.tree)).toEqual(DIAGRAM_ORDER);
		expect(outline(second.tree)).toEqual(outline(first.tree));
	});

	it("orders two siblings with the same name by id, and keeps that after an edit", async () => {
		const owner = await createTestUser();
		const { caseId, goal } = await buildSiblings(owner.id);
		const twinIdList: string[] = [];
		for (const suffix of ["x", "y"]) {
			const twin = await createTestElement(caseId, owner.id, {
				elementType: "EVIDENCE",
				name: "E3",
				url: `https://example.com/twin-${suffix}`,
			});
			await linkEvidence(twin.id, goal.id);
			twinIdList.push(twin.id);
		}
		const expected = [...twinIdList].sort();
		const twinIds = (data: CaseExportNested) =>
			data.tree.children
				.filter((child) => child.name === "E3")
				.map((child) => child.id);

		const before = await exported(owner.id, caseId);
		await prisma.assuranceElement.update({
			where: { id: expected[0] },
			data: { description: "edited" },
		});
		const after = await exported(owner.id, caseId);

		expect(twinIds(before)).toEqual(expected);
		expect(twinIds(after)).toEqual(expected);
		expect(names(after.tree)).toEqual([
			"P1",
			"P2",
			"P10",
			"S1",
			"E1",
			"E2",
			"E3",
			"E3",
			"AG1",
		]);
	});

	it("is the order the document export and the assistant's read_case show", async () => {
		const owner = await createTestUser();
		await mockAuth(owner.id, owner.username, owner.email);
		const { caseId } = await buildSiblings(owner.id);

		const documentData = await getDocumentExportData(caseId, {
			includeComments: false,
		});
		const read = await createCaseTools(owner.id, caseId).read_case.execute?.(
			{},
			{ toolCallId: "call", messages: [] }
		);

		if (!("data" in documentData)) {
			throw new Error(documentData.error);
		}
		expect(names(documentData.data.tree as TreeNode)).toEqual(DIAGRAM_ORDER);
		expect(names((read as { tree: TreeNode }).tree)).toEqual(DIAGRAM_ORDER);
	});
});
