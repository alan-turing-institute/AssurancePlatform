import { beforeEach, describe, expect, it, vi } from "vitest";
import { convertAssuranceCase } from "@/lib/case/convert-case";
import { prisma } from "@/lib/prisma";
import type { TreeNode } from "@/lib/schemas/case-export";
import {
	buildTreeFromElements,
	type ElementWithLinks,
} from "@/lib/transforms/build-tree";
import { fetchCaseFromPrisma } from "../case-fetch-service";

vi.mock("@/lib/prisma", () => ({
	prisma: { assuranceCase: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/permissions", () => ({
	getCasePermission: vi
		.fn()
		.mockResolvedValue({ hasAccess: true, isOwner: true, permission: "ADMIN" }),
}));

function element(
	id: string,
	elementType: string,
	parentId: string | null = null
) {
	return {
		id,
		elementType,
		parentId,
		caseId: "case",
		name: id,
		description: "",
		createdAt: new Date("2026-01-01"),
		context: [],
		inSandbox: false,
		isDefeater: false,
		defeatsElementId: null,
		moduleReferenceId: null,
		evidenceLinksTo: [],
	};
}

function findExported(node: TreeNode, id: string): TreeNode | undefined {
	if (node.id === id) {
		return node;
	}
	for (const child of node.children) {
		const found = findExported(child, id);
		if (found) {
			return found;
		}
	}
}

beforeEach(() => vi.mocked(prisma.assuranceCase.findUnique).mockReset());

describe("counter-goals survive fetching and canvas conversion", () => {
	it.each([
		"GOAL",
		"STRATEGY",
		"PROPERTY_CLAIM",
		"EVIDENCE",
		"AWAY_GOAL",
		"MODULE",
	])("keeps a GOAL defeater of a %s as a side attachment, with its support subtree", async (targetType) => {
		const target = element(
			"target",
			targetType,
			targetType === "GOAL" ? null : "root"
		);
		const claim = element("claim", "PROPERTY_CLAIM", "root");
		if (targetType === "EVIDENCE") {
			target.parentId = null;
			Object.assign(claim, { evidenceLinksTo: [{ evidence: target }] });
		}
		const counter = {
			...element("counter", "GOAL", "target"),
			isDefeater: true,
			defeatsElementId: "target",
		};
		const support = element("support", "PROPERTY_CLAIM", "counter");
		const elements = [
			...(targetType === "GOAL" ? [] : [element("root", "GOAL")]),
			...(targetType === "EVIDENCE" ? [claim] : []),
			target,
			counter,
			support,
		];
		vi.mocked(prisma.assuranceCase.findUnique).mockResolvedValue({
			id: "case",
			name: "Case",
			createdAt: new Date("2026-01-01"),
			publishStatus: "DRAFT",
			elements,
		} as never);

		const exported = buildTreeFromElements(
			elements as unknown as ElementWithLinks[]
		);
		expect(findExported(exported, "counter")).toMatchObject({
			type: "GOAL",
			isDefeater: true,
			defeatsElementId: "target",
			children: [expect.objectContaining({ id: "support" })],
		});

		const result = await fetchCaseFromPrisma("case", "user");
		expect(result).toHaveProperty("data");
		if (!("data" in result)) {
			throw new Error(result.error);
		}
		const { caseNodes, caseEdges } = convertAssuranceCase({
			...result.data,
			goals: result.data.goals ?? [],
		});
		expect(caseNodes).toHaveLength(elements.length);
		const targetNode = caseNodes.find((node) => node.data.id === "target");
		const counterNode = caseNodes.find((node) => node.data.id === "counter");
		expect(counterNode).toMatchObject({
			type: "goal",
			data: {
				isDefeater: true,
				attachedTo: targetNode?.id,
				attachSide: "right",
			},
		});
		expect(caseEdges.filter((edge) => edge.target === counterNode?.id)).toEqual(
			[]
		);
		expect(caseEdges).toContainEqual(
			expect.objectContaining({
				type: "challenges",
				source: counterNode?.id,
				target: targetNode?.id,
			})
		);
		expect(caseEdges).toContainEqual(
			expect.objectContaining({
				type: "support",
				source: counterNode?.id,
				target: "property-support",
			})
		);
	});
	it("does not recurse forever when evidence is reused below its counter-goal", async () => {
		const evidence = element("evidence", "EVIDENCE");
		const root = element("root", "GOAL");
		const claim = {
			...element("claim", "PROPERTY_CLAIM", "root"),
			evidenceLinksTo: [{ evidence }],
		};
		const counter = {
			...element("counter", "GOAL", "evidence"),
			isDefeater: true,
			defeatsElementId: "evidence",
		};
		const support = {
			...element("support", "PROPERTY_CLAIM", "counter"),
			evidenceLinksTo: [{ evidence }],
		};
		const elements = [root, claim, evidence, counter, support];
		vi.mocked(prisma.assuranceCase.findUnique).mockResolvedValue({
			id: "case",
			name: "Case",
			createdAt: new Date("2026-01-01"),
			publishStatus: "DRAFT",
			elements,
		} as never);

		const exported = buildTreeFromElements(
			elements as unknown as ElementWithLinks[]
		);
		expect(findExported(exported, "counter")?.children[0]).toMatchObject({
			id: "support",
			children: [expect.objectContaining({ id: "evidence", children: [] })],
		});
		const result = await fetchCaseFromPrisma("case", "user");
		expect(result).toHaveProperty("data");
		if (!("data" in result)) {
			throw new Error(result.error);
		}
		const { caseNodes } = convertAssuranceCase({
			...result.data,
			goals: result.data.goals ?? [],
		});
		expect(caseNodes.filter((node) => node.data.id === "counter")).toHaveLength(
			1
		);
		expect(caseNodes.some((node) => node.data.id === "support")).toBe(true);
	});
});
