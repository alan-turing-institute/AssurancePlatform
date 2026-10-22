import { describe, expect, it } from "vitest";
import type { CaseExportNested, TreeNode } from "../../schemas/case-export";
import { buildTreeFromElements, type ElementWithLinks } from "../build-tree";
import { flattenNestedToFlat } from "../nested-to-flat";

/**
 * The export tree (flat rows to nested tree) and the import flattening
 * (nested tree to flat rows) with counter-goals: the root is the ordinary
 * goal whatever the row order, evidence carries its counter-goals on its first
 * copy only and is never expanded inside itself, and the flattening takes what
 * hangs from a piece of evidence once however many claims repeat it.
 */

function element(
	id: string,
	overrides: Partial<ElementWithLinks> = {}
): ElementWithLinks {
	return {
		id,
		elementType: "GOAL",
		name: id,
		description: `description of ${id}`,
		parentId: null,
		isDefeater: false,
		defeatsElementId: null,
		assertionStatus: null,
		assumption: null,
		citedElementId: null,
		context: [],
		fromPattern: false,
		inSandbox: false,
		justification: null,
		level: null,
		modifiedFromPattern: false,
		moduleEmbedType: null,
		modulePublicSummary: null,
		moduleReferenceId: null,
		role: null,
		url: null,
		...overrides,
	};
}

function counterGoal(
	id: string,
	parentId: string | null,
	overrides: Partial<ElementWithLinks> = {}
): ElementWithLinks {
	return element(id, {
		elementType: "GOAL",
		isDefeater: true,
		parentId,
		defeatsElementId: parentId,
		...overrides,
	});
}

function evidence(id: string): ElementWithLinks {
	return element(id, {
		elementType: "EVIDENCE",
		url: `https://example.com/${id}`,
	});
}

function claim(
	id: string,
	parentId: string | null,
	linked: ElementWithLinks[] = []
): ElementWithLinks {
	return element(id, {
		elementType: "PROPERTY_CLAIM",
		parentId,
		evidenceLinksTo: linked.map((ev) => ({ evidence: ev })),
	});
}

function nodes(tree: TreeNode): TreeNode[] {
	return [tree, ...tree.children.flatMap(nodes)];
}

function countById(tree: TreeNode): Map<string, number> {
	const counts = new Map<string, number>();
	for (const node of nodes(tree)) {
		counts.set(node.id, (counts.get(node.id) ?? 0) + 1);
	}
	return counts;
}

function permutations<T>(items: T[]): T[][] {
	if (items.length <= 1) {
		return [items];
	}
	return items.flatMap((item, index) =>
		permutations([...items.slice(0, index), ...items.slice(index + 1)]).map(
			(rest) => [item, ...rest]
		)
	);
}

describe("buildTreeFromElements root-finding", () => {
	const top = element("G1", { role: "TOP_LEVEL" });
	const strayOne = counterGoal("CG8", null);
	const strayTwo = counterGoal("CG9", null);
	const argument = claim("P1", "G1");
	const strayBranch = claim("P9", "CG8");

	it.each(
		permutations([top, strayOne, strayTwo])
	)("roots on the ordinary goal whatever the row order (order %#)", (...rows) => {
		const [first, second, third] = rows as ElementWithLinks[];
		const order = [first, second, third, argument, strayBranch];

		const tree = buildTreeFromElements(order as ElementWithLinks[]);

		expect(tree.id).toBe("G1");
		expect(tree.isDefeater).toBeUndefined();
		expect(tree.children.map((child) => child.id)).toEqual(["P1"]);
	});

	it("roots on the ordinary goal when the claim rows come before every goal row", () => {
		const tree = buildTreeFromElements([argument, strayBranch, strayOne, top]);

		expect(tree.id).toBe("G1");
		expect(nodes(tree).map((node) => node.id)).toEqual(["G1", "P1"]);
	});

	it("keeps a counter-goal that has a parent as part of the argument", () => {
		const attached = counterGoal("CG1", "P1");

		const tree = buildTreeFromElements([strayOne, top, argument, attached]);

		expect(tree.id).toBe("G1");
		const p1 = tree.children.find((child) => child.id === "P1");
		expect(p1?.children.map((child) => child.id)).toEqual(["CG1"]);
		expect(p1?.children[0]?.defeatsElementId).toBe("P1");
	});
});

describe("buildTreeFromElements evidence", () => {
	it("repeats shared evidence under every claim that links it, with its counter-goals on the first copy only", () => {
		const e1 = evidence("E1");
		const cg = counterGoal("CG1", "E1");
		const support = claim("P3", "CG1");
		const rows = [
			element("G1", { role: "TOP_LEVEL" }),
			claim("P1", "G1", [e1]),
			claim("P2", "G1", [e1]),
			e1,
			cg,
			support,
		];

		const tree = buildTreeFromElements(rows);

		const counts = countById(tree);
		expect(counts.get("E1")).toBe(2);
		expect(counts.get("CG1")).toBe(1);
		expect(counts.get("P3")).toBe(1);
		const copies = nodes(tree).filter((node) => node.id === "E1");
		expect(copies[0]?.children.map((c) => c.id)).toEqual(["CG1"]);
		expect(copies[1]?.children).toEqual([]);
	});

	it("carries the counter-goals on the first copy met walking the tree, whichever way a claim orders its nested claims and evidence", () => {
		const e1 = evidence("E1");
		const rows = [
			element("G1", { role: "TOP_LEVEL" }),
			claim("P1", "G1", [e1]),
			claim("P2", "P1", [e1]),
			e1,
			counterGoal("CG1", "E1"),
		];

		const tree = buildTreeFromElements(rows);

		const copies = nodes(tree).filter((node) => node.id === "E1");
		expect(copies).toHaveLength(2);
		expect(copies[0]?.children.map((c) => c.id)).toEqual(["CG1"]);
		expect(copies[1]?.children).toEqual([]);
	});

	it("keeps a chain of shared evidence and counter-goals in proportion to its length", () => {
		const levels = 10;
		const rows: ElementWithLinks[] = [element("G1", { role: "TOP_LEVEL" })];
		let parentId = "G1";
		for (let level = 0; level < levels; level += 1) {
			const shared = evidence(`E${level}`);
			rows.push(
				claim(`A${level}`, parentId, [shared]),
				claim(`B${level}`, parentId, [shared]),
				shared,
				counterGoal(`CG${level}`, shared.id)
			);
			parentId = `CG${level}`;
		}

		const tree = buildTreeFromElements(rows);

		// Per level: two claims, two copies of the evidence and one counter-goal.
		expect(nodes(tree)).toHaveLength(1 + 5 * levels);
	});

	it("builds only goal defeaters beneath evidence", () => {
		const e1 = evidence("E1");
		const rows = [
			element("G1", { role: "TOP_LEVEL" }),
			claim("P1", "G1", [e1]),
			e1,
			counterGoal("CG1", "E1"),
			element("CP1", {
				elementType: "PROPERTY_CLAIM",
				parentId: "E1",
				isDefeater: true,
				defeatsElementId: "E1",
			}),
			element("P7", { elementType: "PROPERTY_CLAIM", parentId: "E1" }),
			element("S7", { elementType: "STRATEGY", parentId: "E1" }),
			element("G7", { elementType: "GOAL", parentId: "E1" }),
		];

		const tree = buildTreeFromElements(rows);

		const evidenceNode = nodes(tree).find((node) => node.id === "E1");
		expect(evidenceNode?.children.map((c) => c.id)).toEqual(["CG1"]);
	});

	it("expands a counter-goal only once along any path when its evidence is reused inside it", () => {
		const e1 = evidence("E1");
		const rows = [
			element("G1", { role: "TOP_LEVEL" }),
			claim("P1", "G1", [e1]),
			e1,
			counterGoal("CG1", "E1"),
			claim("P2", "CG1", [e1]),
		];

		const tree = buildTreeFromElements(rows);

		const counts = countById(tree);
		expect(counts.get("E1")).toBe(2);
		expect(counts.get("CG1")).toBe(1);
		expect(counts.get("P2")).toBe(1);
		const inner = nodes(tree).filter((node) => node.id === "E1")[1];
		expect(inner?.children).toEqual([]);
	});

	it("ends on a three-step loop through evidence", () => {
		const e1 = evidence("E1");
		const e2 = evidence("E2");
		const e3 = evidence("E3");
		const rows = [
			element("G1", { role: "TOP_LEVEL" }),
			claim("P1", "G1", [e1]),
			e1,
			e2,
			e3,
			counterGoal("CG1", "E1"),
			claim("P2", "CG1", [e2]),
			counterGoal("CG2", "E2"),
			claim("P3", "CG2", [e3]),
			counterGoal("CG3", "E3"),
			claim("P4", "CG3", [e1]),
		];

		const tree = buildTreeFromElements(rows);

		const counts = countById(tree);
		for (const id of ["CG1", "CG2", "CG3", "P2", "P3", "P4", "E2", "E3"]) {
			expect(counts.get(id), id).toBe(1);
		}
		// E1 under P1 and again, unexpanded, under P4.
		expect(counts.get("E1")).toBe(2);
	});
});

describe("flattenNestedToFlat with evidence that carries counter-goals", () => {
	function node(
		id: string,
		type: TreeNode["type"],
		children: TreeNode[] = [],
		extra: Partial<TreeNode> = {}
	): TreeNode {
		return {
			id,
			type,
			name: id,
			description: `description of ${id}`,
			inSandbox: false,
			assertionStatus: "ASSERTED",
			children,
			...(type === "EVIDENCE" ? { url: `https://example.com/${id}` } : {}),
			...extra,
		} as TreeNode;
	}

	function document(tree: TreeNode): CaseExportNested {
		return {
			version: "1.0",
			exportedAt: "2026-01-01T00:00:00.000Z",
			case: { name: "Case", description: "" },
			tree,
		} as CaseExportNested;
	}

	function counterNode(id: string, children: TreeNode[] = []): TreeNode {
		return node(id, "GOAL", children, { isDefeater: true });
	}

	it("takes the children of evidence repeated under two claims once", () => {
		const copy = () =>
			node("E1", "EVIDENCE", [
				counterNode("CG1", [node("P3", "PROPERTY_CLAIM")]),
			]);
		const tree = node("G1", "GOAL", [
			node("P1", "PROPERTY_CLAIM", [copy()]),
			node("P2", "PROPERTY_CLAIM", [copy()]),
		]);

		const flat = flattenNestedToFlat(document(tree));

		const ids = flat.elements.map((e) => e.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids.sort()).toEqual(["CG1", "E1", "G1", "P1", "P2", "P3"]);
		const byId = new Map(flat.elements.map((e) => [e.id, e]));
		expect(byId.get("CG1")?.parentId).toBe("E1");
		expect(byId.get("CG1")?.isDefeater).toBe(true);
		expect(byId.get("P3")?.parentId).toBe("CG1");
		expect(byId.get("E1")?.parentId).toBeNull();
		expect(
			flat.evidenceLinks
				.map((link) => `${link.evidenceId}>${link.claimId}`)
				.sort()
		).toEqual(["E1>P1", "E1>P2"]);
	});

	it("finds the children of evidence on its first copy when later copies are leaves", () => {
		const tree = node("G1", "GOAL", [
			node("P1", "PROPERTY_CLAIM", [
				node("E1", "EVIDENCE", [
					counterNode("CG1", [node("P3", "PROPERTY_CLAIM")]),
				]),
			]),
			node("P2", "PROPERTY_CLAIM", [node("E1", "EVIDENCE")]),
		]);

		const flat = flattenNestedToFlat(document(tree));

		const ids = flat.elements.map((e) => e.id);
		expect(ids.sort()).toEqual(["CG1", "E1", "G1", "P1", "P2", "P3"]);
		const byId = new Map(flat.elements.map((e) => [e.id, e]));
		expect(byId.get("CG1")?.parentId).toBe("E1");
		expect(byId.get("P3")?.parentId).toBe("CG1");
		expect(
			flat.evidenceLinks
				.map((link) => `${link.evidenceId}>${link.claimId}`)
				.sort()
		).toEqual(["E1>P1", "E1>P2"]);
	});

	it("keeps evidence reused inside its own counter-goal, linked once more and not expanded again", () => {
		const tree = node("G1", "GOAL", [
			node("P1", "PROPERTY_CLAIM", [
				node("E1", "EVIDENCE", [
					counterNode("CG1", [
						node("P2", "PROPERTY_CLAIM", [node("E1", "EVIDENCE")]),
					]),
				]),
			]),
		]);

		const flat = flattenNestedToFlat(document(tree));

		const ids = flat.elements.map((e) => e.id).sort();
		expect(ids).toEqual(["CG1", "E1", "G1", "P1", "P2"]);
		expect(
			flat.evidenceLinks
				.map((link) => `${link.evidenceId}>${link.claimId}`)
				.sort()
		).toEqual(["E1>P1", "E1>P2"]);
	});

	it("walks a chain of counter-goals and evidence to its end", () => {
		const tree = node("G1", "GOAL", [
			node("P1", "PROPERTY_CLAIM", [
				node("E1", "EVIDENCE", [
					counterNode("CG1", [
						node("P2", "PROPERTY_CLAIM", [
							node("E2", "EVIDENCE", [
								counterNode("CG2", [counterNode("CG3")]),
							]),
						]),
					]),
				]),
			]),
		]);

		const flat = flattenNestedToFlat(document(tree));

		const byId = new Map(flat.elements.map((e) => [e.id, e]));
		expect(flat.elements).toHaveLength(8);
		expect(byId.get("CG1")?.parentId).toBe("E1");
		expect(byId.get("P2")?.parentId).toBe("CG1");
		expect(byId.get("CG2")?.parentId).toBe("E2");
		expect(byId.get("CG3")?.parentId).toBe("CG2");
	});

	it("flattens a tree with no evidence children exactly as before", () => {
		const tree = node("G1", "GOAL", [
			node("P1", "PROPERTY_CLAIM", [node("E1", "EVIDENCE")]),
			counterNode("CG1", [node("P2", "PROPERTY_CLAIM")]),
		]);

		const flat = flattenNestedToFlat(document(tree));

		expect(flat.elements.map((e) => [e.id, e.parentId])).toEqual([
			["G1", null],
			["P1", "G1"],
			["E1", null],
			["CG1", "G1"],
			["P2", "CG1"],
		]);
		expect(flat.evidenceLinks).toEqual([{ evidenceId: "E1", claimId: "P1" }]);
	});
});
