import { describe, expect, it } from "vitest";
import type { CaseExportNested, TreeNode } from "@/lib/schemas/case-export";
import {
	buildTreeFromElements,
	type ElementWithLinks,
} from "@/lib/transforms/build-tree";
import {
	computeTreeDiff,
	contextEqual,
	type ElementChange,
	validateTreeStructure,
} from "../tree-diff";

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

	it("sends an update when a named entry is marked as a variable, or the mark is taken off", () => {
		const variable = { ...NAMED_ENTRY, variable: true as const };

		const marked = computeTreeDiff(
			exportWith([NAMED_ENTRY]),
			exportWith([variable])
		).changes;
		const unmarked = computeTreeDiff(
			exportWith([variable]),
			exportWith([NAMED_ENTRY])
		).changes;

		expect(marked).toEqual([
			{ type: "update", elementId: GOAL_ID, data: { context: [variable] } },
		]);
		expect(unmarked).toEqual([
			{ type: "update", elementId: GOAL_ID, data: { context: [NAMED_ENTRY] } },
		]);
		expect(
			computeTreeDiff(exportWith([variable]), exportWith([{ ...variable }]))
				.changes
		).toEqual([]);
	});
});

/**
 * The export shows what hangs from shared evidence E (a counter-goal CG, its
 * claim CGP, and the evidence E3 under that claim) under the first claim A that
 * links it; under claim B the evidence is a leaf.
 */
describe("computeTreeDiff and placeholders", () => {
	function exportWithMarkers(fields: Partial<TreeNode>): CaseExportNested {
		const doc = exportWith(undefined);
		return { ...doc, tree: { ...doc.tree, ...fields } };
	}

	it("sends the marker and hint that were added, and turns them off when the keys are removed", () => {
		const plain = exportWithMarkers({});
		const marked = exportWithMarkers({
			isPlaceholder: true,
			placeholderHint: "Say what to write",
		});

		expect(computeTreeDiff(plain, marked).changes).toEqual([
			{
				type: "update",
				elementId: GOAL_ID,
				data: { isPlaceholder: true, placeholderHint: "Say what to write" },
			},
		]);
		expect(computeTreeDiff(marked, plain).changes).toEqual([
			{
				type: "update",
				elementId: GOAL_ID,
				data: { isPlaceholder: false, placeholderHint: null },
			},
		]);
	});

	it("leaves out the pattern markers, which only the server sets", () => {
		const { changes } = computeTreeDiff(
			exportWithMarkers({}),
			exportWithMarkers({ fromPattern: true, modifiedFromPattern: true })
		);

		expect(changes).toEqual([]);
	});
});

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
		/** The element's name; the id when left out. */
		name?: string;
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
					name: row.name ?? row.id,
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
	// E3 is shown with its counter-goal CG3 under X, which comes first (its name
	// sorts before A and B), and is a leaf inside E's part, which is hidden once
	// A goes.
	const crossed: Model = {
		rows: [
			{ id: "G1", type: "GOAL" },
			{ id: "X", type: "PROPERTY_CLAIM", parent: "G1", name: "0" },
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
	// E2's name sorts before E1's, so the export shows E2 first under M, and E2
	// is a leaf inside E1's hidden part, which is hidden once M goes.
	const sideBySide: Model = {
		rows: [
			{ id: "G1", type: "GOAL" },
			{ id: "M", type: "PROPERTY_CLAIM", parent: "G1" },
			{ id: "B", type: "PROPERTY_CLAIM", parent: "G1" },
			{ id: "E2", type: "EVIDENCE", name: "E0" },
			{ id: "CG2", type: "GOAL", parent: "E2", defeater: true },
			{ id: "P2", type: "PROPERTY_CLAIM", parent: "CG2" },
			{ id: "E1", type: "EVIDENCE" },
			{ id: "CG1", type: "GOAL", parent: "E1", defeater: true },
			{ id: "P1", type: "PROPERTY_CLAIM", parent: "CG1" },
		],
		links: [
			["E2", "M"],
			["E1", "M"],
			["E1", "B"],
			["E2", "P1"],
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
		{
			label:
				"deleting M where E2 is shown first and is a leaf inside E1's hidden part",
			model: sideBySide,
			edit: (tree: TreeNode) => without(tree, "M"),
			deleted: ["M"],
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

type Kind = TreeNode["type"];
const leafOrBranch = (
	id: string,
	type: Kind,
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
const claimNode = (id: string, children: TreeNode[] = []) =>
	leafOrBranch(id, "PROPERTY_CLAIM", children);
const evidenceNode = (id: string, children: TreeNode[] = []) =>
	leafOrBranch(id, "EVIDENCE", children);
const caseOfTree = (tree: TreeNode): CaseExportNested => ({
	version: "1.1",
	exportedAt: "2026-11-25T00:00:00.000Z",
	case: { name: "Case", description: "" },
	tree,
});
const goalWith = (...children: TreeNode[]) =>
	caseOfTree(leafOrBranch("G1", "GOAL", children));
const counterGoalOf = (id: string, children: TreeNode[] = []) =>
	leafOrBranch(id, "GOAL", children, { isDefeater: true });
const changeTypes = (changes: ElementChange[]) => changes.map((c) => c.type);
const deletedIds = (changes: ElementChange[]) =>
	changes
		.filter((c) => c.type === "delete")
		.map((c) => c.elementId)
		.sort();

describe("computeTreeDiff and evidence under a goal", () => {
	it("unlinks and deletes evidence taken off the goal", () => {
		const { changes } = computeTreeDiff(
			goalWith(evidenceNode("E")),
			goalWith()
		);

		expect(changes).toStrictEqual([
			{ type: "delete", elementId: "E" },
			{ type: "unlink_evidence", evidenceId: "E", claimId: "G1" },
		]);
	});

	it("creates evidence added to the goal without a parent and links it", () => {
		const { changes } = computeTreeDiff(
			goalWith(),
			goalWith(evidenceNode("E"))
		);

		expect(changeTypes(changes)).toStrictEqual(["create", "link_evidence"]);
		expect(changes[0]).toMatchObject({ elementId: "E", parentId: null });
		expect(changes[1]).toStrictEqual({
			type: "link_evidence",
			evidenceId: "E",
			claimId: "G1",
		});
	});

	it("sends no change for evidence links that stayed", () => {
		const tree = () => goalWith(claimNode("A", [evidenceNode("E")]));

		expect(computeTreeDiff(tree(), tree()).changes).toStrictEqual([]);
	});

	it("links existing evidence to a claim it was not under before", () => {
		const { changes } = computeTreeDiff(
			goalWith(claimNode("A", [evidenceNode("E")]), claimNode("B")),
			goalWith(
				claimNode("A", [evidenceNode("E")]),
				claimNode("B", [evidenceNode("E")])
			)
		);

		expect(changes).toStrictEqual([
			{ type: "link_evidence", evidenceId: "E", claimId: "B" },
		]);
	});
});

describe("computeTreeDiff and the change summary", () => {
	const current = () =>
		goalWith(
			claimNode("A"),
			claimNode("B"),
			claimNode("C"),
			claimNode("D"),
			claimNode("X")
		);
	const renamed = (id: string, children: TreeNode[] = []) =>
		leafOrBranch(id, "PROPERTY_CLAIM", children, { name: `${id} renamed` });

	it("reports a move on its own as a move, not as an update", () => {
		const { changes, summary } = computeTreeDiff(
			goalWith(claimNode("A", [claimNode("C")]), claimNode("B")),
			goalWith(claimNode("A"), claimNode("B", [claimNode("C")]))
		);

		expect(changes).toStrictEqual([
			{ type: "update", elementId: "C", data: { parentId: "B" } },
		]);
		expect(summary).toStrictEqual({
			created: 0,
			updated: 0,
			deleted: 0,
			moved: 1,
		});
	});

	it("reports a move together with another change as an update", () => {
		const { changes, summary } = computeTreeDiff(
			goalWith(claimNode("A"), claimNode("B", [claimNode("C")])),
			goalWith(claimNode("A", [renamed("C")]), claimNode("B"))
		);

		expect(changes).toStrictEqual([
			{
				type: "update",
				elementId: "C",
				data: { name: "C renamed", parentId: "A" },
			},
		]);
		expect(summary).toStrictEqual({
			created: 0,
			updated: 1,
			deleted: 0,
			moved: 0,
		});
	});

	it("counts created, updated, deleted and moved elements separately", () => {
		const edited = goalWith(
			renamed("A", [claimNode("D")]),
			renamed("B"),
			renamed("C"),
			claimNode("N1"),
			claimNode("N2")
		);

		const { summary } = computeTreeDiff(current(), edited);

		expect(summary).toStrictEqual({
			created: 2,
			updated: 3,
			deleted: 1,
			moved: 1,
		});
	});

	it("counts only a created element as created", () => {
		const { summary } = computeTreeDiff(goalWith(), goalWith(claimNode("N1")));

		expect(summary).toStrictEqual({
			created: 1,
			updated: 0,
			deleted: 0,
			moved: 0,
		});
	});
});

describe("contextEqual", () => {
	const named = { id: "k3f9x2m7qa", name: "w", text: "t", value: "v" };

	it.each([
		{ label: "both missing", a: undefined, b: undefined, equal: true },
		{ label: "missing, then a list", a: undefined, b: ["x"], equal: false },
		{ label: "a list, then missing", a: ["x"], b: undefined, equal: false },
		{
			label: "the same plain entries",
			a: ["x", "y"],
			b: ["x", "y"],
			equal: true,
		},
		{ label: "different plain entries", a: ["x"], b: ["y"], equal: false },
		{ label: "different lengths", a: ["x"], b: ["x", "y"], equal: false },
		{
			label: "the same named entry",
			a: [named],
			b: [{ ...named }],
			equal: true,
		},
		{
			label: "a plain entry, then a named one",
			a: ["w"],
			b: [named],
			equal: false,
		},
		{
			label: "a named entry, then a plain one",
			a: [named],
			b: ["w"],
			equal: false,
		},
	])("compares $label", ({ a, b, equal }) => {
		expect(contextEqual(a, b)).toBe(equal);
	});

	it("sends the new list when a goal gains context, and when a plain entry changes", () => {
		const base = (context?: string[]) =>
			caseOfTree(leafOrBranch("G1", "GOAL", [], { context }));

		const gained = computeTreeDiff(base(), base(["x"])).changes;
		const changed = computeTreeDiff(base(["x"]), base(["y"])).changes;

		expect(gained).toStrictEqual([
			{ type: "update", elementId: "G1", data: { context: ["x"] } },
		]);
		expect(changed).toStrictEqual([
			{ type: "update", elementId: "G1", data: { context: ["y"] } },
		]);
	});
});

describe("computeTreeDiff and what hangs from evidence shown under several claims", () => {
	const shownCopy = () => evidenceNode("E", [leafOrBranch("CG", "GOAL")]);

	it.each([
		{
			label: "one of the claims that show it is deleted and the other keeps it",
			edited: goalWith(claimNode("A", [evidenceNode("E")])),
			deleted: ["B", "CG"],
		},
		{
			label: "the other claim that shows it is deleted",
			edited: goalWith(claimNode("B", [evidenceNode("E")])),
			deleted: ["A", "CG"],
		},
	])("deletes what hangs from the evidence when $label", ({
		edited,
		deleted,
	}) => {
		const current = goalWith(
			claimNode("A", [shownCopy()]),
			claimNode("B", [shownCopy()])
		);

		expect(deletedIds(computeTreeDiff(current, edited).changes)).toStrictEqual(
			deleted
		);
	});
});

describe("computeTreeDiff and evidence taken off the claim that showed it", () => {
	const counterGoal = (id: string, children: TreeNode[] = []) =>
		leafOrBranch(id, "GOAL", children, { isDefeater: true });
	const shownIn = (children: TreeNode[]) =>
		goalWith(
			claimNode("A", [evidenceNode("E", children), evidenceNode("F")]),
			claimNode("B", [evidenceNode("E")])
		);

	it("keeps what hangs from the evidence when other evidence stays on that claim", () => {
		const { changes } = computeTreeDiff(
			shownIn([counterGoal("CG")]),
			goalWith(
				claimNode("A", [evidenceNode("F")]),
				claimNode("B", [evidenceNode("E")])
			)
		);

		expect(deletedIds(changes)).toStrictEqual([]);
		expect(changes).toContainEqual({
			type: "unlink_evidence",
			evidenceId: "E",
			claimId: "A",
		});
	});

	it("moves the counter-goal to its new claim and unlinks the evidence from the claim that showed it", () => {
		const { changes } = computeTreeDiff(
			goalWith(
				claimNode("A", [evidenceNode("E", [counterGoal("CG")])]),
				claimNode("B", [evidenceNode("E")]),
				claimNode("C")
			),
			goalWith(
				claimNode("A"),
				claimNode("B", [evidenceNode("E")]),
				claimNode("C", [counterGoal("CG")])
			)
		);

		expect(changes).toHaveLength(2);
		expect(changes).toContainEqual({
			type: "update",
			elementId: "CG",
			data: { parentId: "C" },
		});
		expect(changes).toContainEqual({
			type: "unlink_evidence",
			evidenceId: "E",
			claimId: "A",
		});
	});

	it("keeps every counter-goal that hung from the evidence", () => {
		const { changes } = computeTreeDiff(
			shownIn([counterGoal("CG"), counterGoal("CG2")]),
			goalWith(claimNode("B", [evidenceNode("E")]))
		);

		expect(deletedIds(changes)).toStrictEqual(["A", "F"]);
	});

	it("deletes what the person removed from the copy they edited, and no more", () => {
		const current = shownIn([
			counterGoal("CG"),
			counterGoal("CG2", [claimNode("P2")]),
		]);
		const edited = goalWith(
			claimNode("B", [evidenceNode("E", [counterGoal("CG")])])
		);

		expect(deletedIds(computeTreeDiff(current, edited).changes)).toStrictEqual([
			"A",
			"CG2",
			"F",
			"P2",
		]);
	});

	it("keeps the person's edit to an element that is also carried over", () => {
		const evidenceBeneath = () =>
			counterGoal("CG", [claimNode("CGP", [evidenceNode("E3")])]);
		const current = goalWith(
			claimNode("A", [evidenceNode("E", [evidenceBeneath()])]),
			claimNode("B", [evidenceNode("E")]),
			claimNode("C", [evidenceNode("E3")])
		);
		const edited = goalWith(
			claimNode("B", [evidenceNode("E")]),
			claimNode("C", [leafOrBranch("E3", "EVIDENCE", [], { name: "kept" })])
		);

		const { changes } = computeTreeDiff(current, edited);

		expect(deletedIds(changes)).toStrictEqual(["A"]);
		expect(changes.filter((c) => c.type === "update")).toStrictEqual([
			{ type: "update", elementId: "E3", data: { name: "kept" } },
		]);
	});

	it("finishes where evidence shows itself again beneath itself", () => {
		const inner = evidenceNode("E1", [leafOrBranch("CG1", "GOAL")]);
		const e1 = evidenceNode("E1", [
			counterGoalOf("CG1", [claimNode("P1", [inner])]),
		]);
		const e0 = evidenceNode("E0", [
			counterGoalOf("CG0", [claimNode("P0", [e1])]),
		]);
		const current = goalWith(
			claimNode("A", [e0]),
			claimNode("B", [evidenceNode("E0")])
		);
		const edited = goalWith(claimNode("B", [evidenceNode("E0")]));

		expect(deletedIds(computeTreeDiff(current, edited).changes)).toStrictEqual([
			"A",
		]);
	});

	it("keeps the part of evidence that an earlier-listed piece of evidence brought back", () => {
		const e2 = () =>
			evidenceNode("E2", [counterGoalOf("CG2", [claimNode("P2")])]);
		const e1 = evidenceNode("E1", [
			counterGoalOf("CG1", [claimNode("P1", [evidenceNode("E2")])]),
		]);
		const current = goalWith(
			claimNode("M", [e2(), e1]),
			claimNode("B", [evidenceNode("E1")])
		);
		const edited = goalWith(claimNode("B", [evidenceNode("E1")]));

		expect(deletedIds(computeTreeDiff(current, edited).changes)).toStrictEqual([
			"M",
		]);
	});
});

describe("validateTreeStructure", () => {
	it("accepts a tree with one root, evidence included", () => {
		const tree = goalWith(claimNode("A", [evidenceNode("E")]));

		expect(validateTreeStructure(tree)).toStrictEqual([]);
	});

	it("reports a tree whose root is evidence as having no root", () => {
		expect(validateTreeStructure(caseOfTree(evidenceNode("E")))).toStrictEqual([
			"Tree must have a root element",
		]);
	});

	it("reports every element in a loop of parents", () => {
		const looped = caseOfTree(
			leafOrBranch("G1", "GOAL", [claimNode("A", [leafOrBranch("G1", "GOAL")])])
		);

		expect(validateTreeStructure(looped)).toStrictEqual([
			"Tree must have a root element",
			'Circular reference detected involving element "G1"',
			'Circular reference detected involving element "A"',
		]);
	});
});
