import { describe, expect, it } from "vitest";
import type { ElementType } from "@/lib/schemas/case-export";
import { buildTreeFromElements } from "@/lib/transforms/build-tree";
import { seededShuffle } from "@/src/__tests__/utils/seeded-shuffle";
import { treeRow as row } from "@/src/__tests__/utils/tree-row-kit";
import { getLayoutedElements } from "../layout-helper";

/**
 * The export writes a parent's children in the order the diagram lays them
 * out, left to right. The same siblings are given to the layout (as nodes and
 * edges) and to the export (as rows), each in a scrambled order, and the two
 * rows of names are compared.
 */

const NODE_TYPE: Partial<Record<ElementType, string>> = {
	GOAL: "goal",
	STRATEGY: "strategy",
	PROPERTY_CLAIM: "property",
	EVIDENCE: "evidence",
	AWAY_GOAL: "awayGoal",
	MODULE: "module",
};

interface Sibling {
	name: string;
	type: ElementType;
}

/** The siblings' names in the order the layout puts them, left to right. */
async function diagramOrder(
	siblings: Sibling[],
	seed: number
): Promise<string[]> {
	const nodes = [
		{ id: "root", type: "goal", name: "G1" },
		...siblings.map((s) => ({
			id: `n-${s.name}`,
			type: NODE_TYPE[s.type] ?? "property",
			name: s.name,
		})),
	].map((n) => ({
		id: n.id,
		type: n.type,
		position: { x: 0, y: 0 },
		data: { name: n.name },
		hidden: false,
	}));
	const edges = siblings.map((s) => ({
		id: `edge-${s.name}`,
		source: "root",
		target: `n-${s.name}`,
		hidden: false,
	}));
	const laid = await getLayoutedElements(
		seededShuffle(nodes, seed),
		seededShuffle(edges, seed + 1),
		{ direction: "TB" }
	);
	return laid.nodes
		.filter((n) => n.id !== "root")
		.sort((a, b) => a.position.x - b.position.x)
		.map((n) => String(n.data.name));
}

/** The siblings' names in the order the export writes them. */
function exportOrder(siblings: Sibling[], seed: number): string[] {
	const evidenceRows = siblings
		.filter((s) => s.type === "EVIDENCE")
		.map((s) => row(`n-${s.name}`, s.type, s.name, null));
	const rows = [
		{
			...row("root", "GOAL", "G1", null),
			evidenceLinksTo: evidenceRows.map((evidence) => ({ evidence })),
		},
		...siblings
			.filter((s) => s.type !== "EVIDENCE")
			.map((s) => row(`n-${s.name}`, s.type, s.name, "root")),
		...evidenceRows,
	];
	const tree = buildTreeFromElements(seededShuffle(rows, seed));
	return (tree.children ?? []).map((child) => String(child.name));
}

const MIXED: Sibling[] = [
	{ name: "P10", type: "PROPERTY_CLAIM" },
	{ name: "P2", type: "PROPERTY_CLAIM" },
	{ name: "P1", type: "PROPERTY_CLAIM" },
	{ name: "S1", type: "STRATEGY" },
	{ name: "S10", type: "STRATEGY" },
	{ name: "S2", type: "STRATEGY" },
	{ name: "E10", type: "EVIDENCE" },
	{ name: "E2", type: "EVIDENCE" },
	{ name: "E1", type: "EVIDENCE" },
	{ name: "AG10", type: "AWAY_GOAL" },
	{ name: "AG2", type: "AWAY_GOAL" },
	{ name: "M1", type: "MODULE" },
	{ name: "AG1", type: "AWAY_GOAL" },
];

describe("the order of siblings in the diagram and in the export", () => {
	it("is the same for claims, strategies, evidence, away goals and modules in any starting order", async () => {
		for (const seed of [3, 11, 29]) {
			const diagram = await diagramOrder(MIXED, seed);
			expect(exportOrder(MIXED, seed + 100)).toEqual(diagram);
		}
		expect(exportOrder(MIXED, 1)).toEqual([
			"P1",
			"P2",
			"P10",
			"S1",
			"S2",
			"S10",
			"E1",
			"E2",
			"E10",
			"AG1",
			"AG2",
			"AG10",
			"M1",
		]);
	});

	it("is the same for dotted identifiers and for prefixes of different lengths", async () => {
		const dotted: Sibling[] = [
			"P1.10",
			"P1.2",
			"P1.1",
			"P1",
			"P10",
			"P2",
			"P2.1",
			"CP1",
			"CP10",
			"CP2",
			"PA1",
			"A1",
			"A10",
		].map((name) => ({ name, type: "PROPERTY_CLAIM" }));
		for (const seed of [5, 17]) {
			const diagram = await diagramOrder(dotted, seed);
			expect(exportOrder(dotted, seed + 100)).toEqual(diagram);
		}
	});
});
