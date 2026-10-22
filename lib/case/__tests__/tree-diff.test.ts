import { describe, expect, it } from "vitest";
import type { CaseExportNested, TreeNode } from "@/lib/schemas/case-export";
import {
	buildTreeFromElements,
	type ElementWithLinks,
} from "@/lib/transforms/build-tree";
import { computeTreeDiff } from "../tree-diff";

const GOAL_ID = "00000000-0000-4000-8000-000000000001";
const NAMED_ENTRY = {
	id: "k3f9x2m7qa",
	name: "window",
	text: "the interval",
	value: "5 minutes",
};

function exportWith(context: TreeNode["context"]): CaseExportNested {
	return {
		version: "1.1",
		exportedAt: "2026-10-19T00:00:00.000Z",
		case: { name: "Case", description: "" },
		tree: {
			id: GOAL_ID,
			type: "GOAL",
			name: "G1",
			description: "Goal",
			inSandbox: false,
			context,
			children: [],
		},
	};
}

describe("computeTreeDiff and context", () => {
	it("sends no update for named entries that did not change, whatever their key order", () => {
		const current = exportWith(["plain", NAMED_ENTRY]);
		const reordered = exportWith([
			"plain",
			{
				value: "5 minutes",
				text: "the interval",
				name: "window",
				id: "k3f9x2m7qa",
			},
		]);

		const { changes } = computeTreeDiff(current, reordered);

		expect(changes).toEqual([]);
	});

	it("sends the whole context list when a named entry's text changes", () => {
		const edited = exportWith([
			"plain",
			{ ...NAMED_ENTRY, text: "a new meaning" },
		]);

		const { changes } = computeTreeDiff(
			exportWith(["plain", NAMED_ENTRY]),
			edited
		);

		expect(changes).toEqual([
			{
				type: "update",
				elementId: GOAL_ID,
				data: { context: ["plain", { ...NAMED_ENTRY, text: "a new meaning" }] },
			},
		]);
	});

	it("sends an update when a plain entry becomes a named one", () => {
		const { changes } = computeTreeDiff(
			exportWith(["window"]),
			exportWith([NAMED_ENTRY])
		);

		expect(changes).toHaveLength(1);
	});
});

/**
 * The export shows what hangs from shared evidence E (a counter-goal CG, its
 * claim CGP, and the evidence E3 under that claim) under the first claim A that
 * links it; under claim B the evidence is a leaf.
 */
describe("computeTreeDiff and what hangs from shared evidence", () => {
	const node = (
		id: string,
		type: TreeNode["type"],
		children: TreeNode[] = [],
		extra: Partial<TreeNode> = {}
	): TreeNode => ({
		id,
		type,
		name: id,
		description: id,
		inSandbox: false,
		children,
		...extra,
	});
	const counterGoal = () =>
		node(
			"CG",
			"GOAL",
			[node("CGP", "PROPERTY_CLAIM", [node("E3", "EVIDENCE")])],
			{ isDefeater: true }
		);
	const claim = (id: string, evidence: TreeNode[]) =>
		node(id, "PROPERTY_CLAIM", evidence);
	const caseOf = (claims: TreeNode[]): CaseExportNested => ({
		version: "1.1",
		exportedAt: "2026-10-21T00:00:00.000Z",
		case: { name: "Case", description: "" },
		tree: node("G1", "GOAL", claims),
	});
	const current = caseOf([
		claim("A", [node("E", "EVIDENCE", [counterGoal()])]),
		claim("B", [node("E", "EVIDENCE")]),
	]);
	const deletedBy = (edited: CaseExportNested) =>
		computeTreeDiff(current, edited)
			.changes.filter((change) => change.type === "delete")
			.map((change) => change.elementId)
			.sort();

	it.each([
		{
			label: "the claim that shows it is deleted",
			edited: caseOf([claim("B", [node("E", "EVIDENCE")])]),
			deleted: ["A"],
		},
		{
			label: "the evidence is removed from the claim that shows it",
			edited: caseOf([claim("A", []), claim("B", [node("E", "EVIDENCE")])]),
			deleted: [],
		},
	])("keeps the counter-goal, its claim and their evidence when $label", ({
		edited,
		deleted,
	}) => {
		const { changes } = computeTreeDiff(current, edited);

		expect(deletedBy(edited)).toEqual(deleted);
		expect(changes).toContainEqual({
			type: "unlink_evidence",
			evidenceId: "E",
			claimId: "A",
		});
		expect(
			changes.filter(
				(change) =>
					change.type === "unlink_evidence" && change.evidenceId === "E3"
			)
		).toEqual([]);
	});

	it.each([
		{
			label: "the counter-goal is removed from the copy that shows it",
			edited: caseOf([
				claim("A", [node("E", "EVIDENCE")]),
				claim("B", [node("E", "EVIDENCE")]),
			]),
			deleted: ["CG", "CGP", "E3"],
		},
		{
			label: "the evidence is removed from every claim",
			edited: caseOf([claim("A", []), claim("B", [])]),
			deleted: ["CG", "CGP", "E", "E3"],
		},
	])("still deletes what hangs from the evidence when $label", ({
		edited,
		deleted,
	}) => {
		expect(deletedBy(edited)).toEqual(deleted);
	});
});

/**
 * Cases built from rows and links and exported the way the server exports
 * them, so which copy of shared evidence shows its counter-goals is the one the
 * export picks.
 */
describe("computeTreeDiff on an exported case with shared evidence", () => {
	interface Row {
		defeater?: boolean;
		id: string;
		parent?: string;
		type: TreeNode["type"];
	}
	interface Model {
		links: [evidence: string, claim: string][];
		rows: Row[];
	}

	const exportOf = ({ rows, links }: Model): CaseExportNested => {
		const byId = new Map<string, ElementWithLinks>(
			rows.map((row) => [
				row.id,
				{
					id: row.id,
					elementType: row.type,
					name: row.id,
					description: row.id,
					inSandbox: false,
					parentId: row.parent ?? null,
					isDefeater: row.defeater ?? false,
					defeatsElementId: null,
					assertionStatus: null,
					assumption: null,
					citedElementId: null,
					context: [],
					fromPattern: false,
					modifiedFromPattern: false,
					moduleEmbedType: null,
					modulePublicSummary: null,
					moduleReferenceId: null,
					justification: null,
					level: null,
					role: null,
					url: null,
					evidenceLinksTo: [],
				},
			])
		);
		for (const [evidence, claim] of links) {
			byId.get(claim)?.evidenceLinksTo?.push({
				evidence: byId.get(evidence) as ElementWithLinks,
			});
		}
		return {
			version: "1.1",
			exportedAt: "2026-10-21T00:00:00.000Z",
			case: { name: "Case", description: "" },
			tree: buildTreeFromElements([...byId.values()]),
		};
	};
	const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
	/** The tree without the nodes of that id, only those under `under` if given. */
	const without = (tree: TreeNode, id: string, under?: string): TreeNode => ({
		...tree,
		children: tree.children
			.filter((child) => !(child.id === id && (under ?? tree.id) === tree.id))
			.map((child) => without(child, id, under)),
	});
	/** The tree with `change` applied to the nodes of that id under `under`. */
	const change = (
		tree: TreeNode,
		id: string,
		under: string,
		apply: (node: TreeNode) => TreeNode
	): TreeNode => ({
		...tree,
		children: tree.children.map((child) =>
			child.id === id && tree.id === under
				? apply(child)
				: change(child, id, under, apply)
		),
	});
	const find = (tree: TreeNode, id: string): TreeNode | undefined =>
		tree.id === id
			? tree
			: tree.children.map((child) => find(child, id)).find(Boolean);
	const counterGoal = (id: string): TreeNode => ({
		id,
		type: "GOAL",
		name: id,
		description: id,
		inSandbox: false,
		isDefeater: true,
		children: [],
	});

	// E is shown with its counter-goal CG under claim A; under B it is a leaf.
	const shared: Model = {
		rows: [
			{ id: "G1", type: "GOAL" },
			{ id: "A", type: "PROPERTY_CLAIM", parent: "G1" },
			{ id: "B", type: "PROPERTY_CLAIM", parent: "G1" },
			{ id: "E", type: "EVIDENCE" },
			{ id: "CG", type: "GOAL", parent: "E", defeater: true },
			{ id: "CGP", type: "PROPERTY_CLAIM", parent: "CG" },
			{ id: "E3", type: "EVIDENCE" },
		],
		links: [
			["E", "A"],
			["E", "B"],
			["E3", "CGP"],
		],
	};
	// E3 is shown with its counter-goal CG3 under X, which comes first, and is a
	// leaf inside E's part, which is hidden once A goes.
	const crossed: Model = {
		rows: [
			{ id: "G1", type: "GOAL" },
			{ id: "X", type: "PROPERTY_CLAIM", parent: "G1" },
			...shared.rows.slice(1),
			{ id: "CG3", type: "GOAL", parent: "E3", defeater: true },
			{ id: "P3", type: "PROPERTY_CLAIM", parent: "CG3" },
			{ id: "E5", type: "EVIDENCE" },
		],
		links: [["E3", "X"], ...shared.links, ["E5", "P3"]],
	};
	// Evidence inside each other's counter-goals: E1 is shown under A, E2 under P1.
	const cycle: Model = {
		rows: [
			{ id: "G1", type: "GOAL" },
			{ id: "A", type: "PROPERTY_CLAIM", parent: "G1" },
			{ id: "B", type: "PROPERTY_CLAIM", parent: "G1" },
			{ id: "E1", type: "EVIDENCE" },
			{ id: "CG1", type: "GOAL", parent: "E1", defeater: true },
			{ id: "P1", type: "PROPERTY_CLAIM", parent: "CG1" },
			{ id: "E2", type: "EVIDENCE" },
			{ id: "CG2", type: "GOAL", parent: "E2", defeater: true },
			{ id: "P2", type: "PROPERTY_CLAIM", parent: "CG2" },
		],
		links: [
			["E1", "A"],
			["E1", "B"],
			["E2", "P1"],
			["E1", "P2"],
		],
	};
	// E2 is shown inside E1's hidden part and is a leaf under C.
	const nested: Model = {
		rows: [
			{ id: "G1", type: "GOAL" },
			{ id: "A", type: "PROPERTY_CLAIM", parent: "G1" },
			{ id: "B", type: "PROPERTY_CLAIM", parent: "G1" },
			{ id: "C", type: "PROPERTY_CLAIM", parent: "G1" },
			{ id: "E1", type: "EVIDENCE" },
			{ id: "CG1", type: "GOAL", parent: "E1", defeater: true },
			{ id: "P1", type: "PROPERTY_CLAIM", parent: "CG1" },
			{ id: "E2", type: "EVIDENCE" },
			{ id: "CG2", type: "GOAL", parent: "E2", defeater: true },
			{ id: "P2", type: "PROPERTY_CLAIM", parent: "CG2" },
		],
		links: [
			["E1", "A"],
			["E1", "B"],
			["E2", "P1"],
			["E2", "C"],
		],
	};

	it.each([
		{
			label: "deleting A and adding a counter-goal under B's copy of E",
			model: shared,
			edit: (tree: TreeNode) =>
				change(without(tree, "A"), "E", "B", (node) => ({
					...node,
					children: [counterGoal("CG2")],
				})),
			deleted: ["A"],
			created: ["CG2"],
		},
		{
			label: "deleting A and pasting CG beneath B's copy of E",
			model: shared,
			edit: (tree: TreeNode) => {
				const pasted = copy(find(tree, "CG") as TreeNode);
				return change(without(tree, "A"), "E", "B", (node) => ({
					...node,
					children: [pasted],
				}));
			},
			deleted: ["A"],
			created: [],
		},
		{
			label: "deleting A and CG3 from X's visible copy of E3",
			model: crossed,
			edit: (tree: TreeNode) => without(without(tree, "A"), "CG3"),
			deleted: ["A", "CG3", "E5", "P3"],
			created: [],
		},
		{
			label: "deleting A and removing E5 from P3, which X's copy of E3 shows",
			model: crossed,
			edit: (tree: TreeNode) => without(without(tree, "A"), "E5"),
			deleted: ["A", "E5"],
			created: [],
		},
		{
			label: "deleting A where E1 and E2 sit in each other's counter-goals",
			model: cycle,
			edit: (tree: TreeNode) => without(tree, "A"),
			deleted: ["A"],
			created: [],
		},
		{
			label: "deleting A where E2 is shown inside E1's hidden part",
			model: nested,
			edit: (tree: TreeNode) => without(tree, "A"),
			deleted: ["A"],
			created: [],
		},
		{
			label: "deleting A and C where E2 is shown inside E1's hidden part",
			model: nested,
			edit: (tree: TreeNode) => without(without(tree, "A"), "C"),
			deleted: ["A", "C"],
			created: [],
		},
	])("when $label, deletes only what the edit removes", ({
		model,
		edit,
		deleted,
		created,
	}) => {
		const current = exportOf(model);
		const edited = { ...copy(current), tree: edit(copy(current.tree)) };

		const { changes } = computeTreeDiff(current, edited);

		const idsOf = (type: string) =>
			changes
				.filter((c) => c.type === type)
				.map((c) => (c as { elementId: string }).elementId)
				.sort();
		expect(idsOf("delete")).toEqual(deleted);
		expect(idsOf("create")).toEqual(created);
	});
});
