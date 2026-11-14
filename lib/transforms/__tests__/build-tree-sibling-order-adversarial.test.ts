import { describe, expect, it } from "vitest";
import { allOrders, seededShuffle } from "@/src/__tests__/utils/seeded-shuffle";
import { treeRow as row } from "@/src/__tests__/utils/tree-row-kit";
import type { TreeNode } from "../../schemas/case-export";
import { buildTreeFromElements, type ElementWithLinks } from "../build-tree";

/**
 * The order of a parent's children in the exported tree: kind first
 * (strategies and claims, then evidence, then away goals and modules), then
 * the name in natural numeric order, then the element id. Rows arrive in any
 * order the database likes, so every test here either states the expected
 * order or checks that every arrangement of the rows gives the same tree.
 */

const goal = (
	id: string,
	name: string | null = id,
	parentId: string | null = null
) => row(id, "GOAL", name, parentId);
const claim = (id: string, name: string | null, parentId: string) =>
	row(id, "PROPERTY_CLAIM", name, parentId);
const strategy = (id: string, name: string | null, parentId: string) =>
	row(id, "STRATEGY", name, parentId);
const away = (id: string, name: string | null, parentId: string) =>
	row(id, "AWAY_GOAL", name, parentId);
const module_ = (id: string, name: string | null, parentId: string) =>
	row(id, "MODULE", name, parentId);
const counter = (id: string, name: string | null, parentId: string | null) =>
	row(id, "GOAL", name, parentId, {
		isDefeater: true,
		defeatsElementId: parentId,
	});
const evidence = (id: string, name: string | null) =>
	row(id, "EVIDENCE", name, null);

/** The rows as the export query returns them: each claim carries copies of its evidence. */
function link(
	claimRow: ElementWithLinks,
	...pieces: ElementWithLinks[]
): ElementWithLinks {
	return {
		...claimRow,
		evidenceLinksTo: pieces.map((piece) => ({ evidence: { ...piece } })),
	};
}

const names = (nodes: TreeNode[] | undefined) =>
	(nodes ?? []).map((node) => node.name);

function descend(root: TreeNode, ...path: string[]): TreeNode {
	let node = root;
	for (const step of path) {
		const next = (node.children ?? []).find((child) => child.id === step);
		if (!next) {
			throw new Error(`no ${step} under ${node.id}`);
		}
		node = next;
	}
	return node;
}

/** Every node, parents before children, children in the order written. */
function walk(node: TreeNode, visit: (n: TreeNode) => void): void {
	visit(node);
	for (const child of node.children ?? []) {
		walk(child, visit);
	}
}

describe("the order of a parent's children", () => {
	it("is kind, then name in natural numeric order, whatever order the rows come in", () => {
		const rows = [
			goal("g"),
			strategy("s1", "S1", "g"),
			claim("p10", "P10", "g"),
			away("ag1", "AG1", "g"),
			claim("p2", "P2", "g"),
			module_("m1", "M1", "g"),
			claim("p1", "P1", "g"),
			strategy("s2", "S2", "g"),
			away("ag10", "AG10", "g"),
			away("ag2", "AG2", "g"),
		];
		const expected = [
			"P1",
			"P2",
			"P10",
			"S1",
			"S2",
			"AG1",
			"AG2",
			"AG10",
			"M1",
		];
		for (let seed = 1; seed <= 40; seed++) {
			const tree = buildTreeFromElements(seededShuffle(rows, seed));
			expect(names(tree.children)).toEqual(expected);
		}
	});

	it("gives a claim's own children, then its evidence, then its away goals when evidence is linked rather than parented", () => {
		const e1 = evidence("e1", "E1");
		const e2 = evidence("e2", "E2");
		const e10 = evidence("e10", "E10");
		const rows = [
			goal("g"),
			link(claim("p1", "P1", "g"), e10, e1, e2),
			claim("p1.10", "P1.10", "p1"),
			claim("p1.2", "P1.2", "p1"),
			away("ag1", "AG1", "p1"),
			strategy("s1", "S1", "p1"),
			e1,
			e2,
			e10,
		];
		for (let seed = 1; seed <= 40; seed++) {
			const tree = buildTreeFromElements(seededShuffle(rows, seed));
			expect(names(descend(tree, "p1").children)).toEqual([
				"P1.2",
				"P1.10",
				"S1",
				"E1",
				"E2",
				"E10",
				"AG1",
			]);
		}
	});

	it("does not depend on the order the linked evidence is listed in", () => {
		const e = [
			evidence("e1", "E1"),
			evidence("e2", "E2"),
			evidence("e3", "E3"),
		];
		for (const order of allOrders(e)) {
			const tree = buildTreeFromElements([
				goal("g"),
				link(claim("p1", "P1", "g"), ...order),
				...e,
			]);
			expect(names(descend(tree, "p1").children)).toEqual(["E1", "E2", "E3"]);
		}
	});

	it("gives the same tree for every arrangement of the rows and of the evidence links", () => {
		const e1 = evidence("e1", "E1");
		const e2 = evidence("e2", "E2");
		const rows = [
			goal("g"),
			link(claim("p10", "P10", "g"), e2, e1),
			claim("p2", "P2", "g"),
			link(strategy("s1", "S1", "g"), e1),
			away("ag1", "AG1", "g"),
			link(claim("p2.1", "P2.1", "p2"), e2),
			e1,
			e2,
		];
		const reference = buildTreeFromElements(rows);
		const lastRow = rows.slice(7);
		// seven rows give 5040 arrangements; the eighth row always stays last
		for (const order of allOrders(rows.slice(0, 7))) {
			const arranged = [...order, ...lastRow].map((r, index) =>
				r.evidenceLinksTo
					? {
							...r,
							evidenceLinksTo: seededShuffle(r.evidenceLinksTo, index + 1),
						}
					: r
			);
			expect(buildTreeFromElements(arranged)).toEqual(reference);
		}
	});

	it("puts kind before name and name before id", () => {
		const e0 = evidence("zzz", "E0");
		const rows = [
			link(goal("g"), e0),
			claim("yyy", "P9", "g"),
			away("aaa", "AG0", "g"),
			strategy("bbb", "S1", "g"),
			e0,
		];
		for (let seed = 1; seed <= 20; seed++) {
			const tree = buildTreeFromElements(seededShuffle(rows, seed));
			// name alone would give AG0, E0, P9, S1; id alone aaa, bbb, yyy, zzz
			expect(tree.children?.map((n) => n.id)).toEqual([
				"yyy",
				"bbb",
				"zzz",
				"aaa",
			]);
		}
	});

	it("breaks a tie between equal names by element id", () => {
		const rows = [
			goal("g"),
			claim("c", "P1", "g"),
			claim("a", "P1", "g"),
			claim("b", "P1", "g"),
		];
		for (const order of allOrders(rows.slice(1))) {
			const tree = buildTreeFromElements([
				rows[0] as ElementWithLinks,
				...order,
			]);
			expect(tree.children?.map((n) => n.id)).toEqual(["a", "b", "c"]);
		}
	});

	it("breaks a tie between two pieces of evidence both named E3 by element id", () => {
		const first = evidence("aaa", "E3");
		const second = evidence("bbb", "E3");
		for (const links of [
			[first, second],
			[second, first],
		]) {
			const tree = buildTreeFromElements([
				goal("g"),
				link(claim("p", "P1", "g"), ...links),
				first,
				second,
			]);
			expect(descend(tree, "p").children?.map((n) => n.id)).toEqual([
				"aaa",
				"bbb",
			]);
		}
	});

	it("breaks ties among missing, empty and repeated names by element id, every time", () => {
		const rows = [
			goal("g"),
			claim("n3", null, "g"),
			claim("n1", null, "g"),
			claim("e2", "", "g"),
			claim("e1", "", "g"),
			claim("x2", "free text", "g"),
			claim("x1", "free text", "g"),
			claim("p1", "P1", "g"),
		];
		const reference = buildTreeFromElements(rows);
		for (let seed = 1; seed <= 40; seed++) {
			expect(buildTreeFromElements(seededShuffle(rows, seed))).toEqual(
				reference
			);
		}
		const ids = reference.children?.map((n) => n.id) ?? [];
		// a missing or empty name comes before any other name
		for (const blank of ["n1", "n3", "e1", "e2"]) {
			expect(ids.indexOf(blank)).toBeLessThan(ids.indexOf("x1"));
		}
		expect(ids.indexOf("x2")).toBeLessThan(ids.indexOf("p1"));
		expect(ids.indexOf("x1")).toBeLessThan(ids.indexOf("x2"));
		expect(ids.indexOf("n1")).toBeLessThan(ids.indexOf("n3"));
		expect(ids.indexOf("e1")).toBeLessThan(ids.indexOf("e2"));
	});

	it("places names that differ only in case, or only in leading zeros, the same way each time", () => {
		const rows = [
			goal("g"),
			claim("a", "P1", "g"),
			claim("b", "p1", "g"),
			claim("c", "P01", "g"),
			claim("d", "P001", "g"),
			claim("e", "P2", "g"),
			claim("f", "p2", "g"),
			claim("h", "P10", "g"),
		];
		const reference = buildTreeFromElements(rows);
		for (let seed = 1; seed <= 40; seed++) {
			expect(buildTreeFromElements(seededShuffle(rows, seed))).toEqual(
				reference
			);
		}
		const position = (id: string) =>
			reference.children?.findIndex((n) => n.id === id) ?? -1;
		for (const low of ["a", "b", "c", "d"]) {
			for (const high of ["e", "f"]) {
				expect(position(low)).toBeLessThan(position(high));
			}
		}
		expect(position("h")).toBe(6);
	});

	it("keeps counter-goals under a piece of evidence in the same order", () => {
		const rows = [
			goal("g"),
			link(claim("p", "P1", "g"), evidence("e", "E1")),
			evidence("e", "E1"),
			counter("c10", "G10", "e"),
			counter("c2", "G2", "e"),
			counter("c1", "G1", "e"),
		];
		for (let seed = 1; seed <= 40; seed++) {
			const tree = buildTreeFromElements(seededShuffle(rows, seed));
			expect(names(descend(tree, "p", "e").children)).toEqual([
				"G1",
				"G2",
				"G10",
			]);
		}
	});

	it("orders a claim's defeaters by their own prefix and number among its other children", () => {
		const defeater = (id: string, name: string) =>
			row(id, "PROPERTY_CLAIM", name, "p", {
				isDefeater: true,
				defeatsElementId: "p",
			});
		const rows = [
			goal("g"),
			claim("p", "P5", "g"),
			claim("p1", "P5.1", "p"),
			defeater("cp10", "CP10"),
			strategy("s1", "S1", "p"),
			defeater("cp2", "CP2"),
			claim("p2", "P5.10", "p"),
			defeater("cp1", "CP1"),
			defeater("ccp1", "CCP1"),
		];
		for (let seed = 1; seed <= 40; seed++) {
			const tree = buildTreeFromElements(seededShuffle(rows, seed));
			expect(names(descend(tree, "p").children)).toEqual([
				"CCP1",
				"CP1",
				"CP2",
				"CP10",
				"P5.1",
				"P5.10",
				"S1",
			]);
		}
	});

	it("ranks a goal, a counter-goal and any other kind with the claims", () => {
		const rows = [
			goal("g"),
			evidence("e", "E1"),
			link(claim("p", "P5", "g"), evidence("e", "E1")),
			counter("cg", "Z1", "p"),
			row("ctx", "CONTEXT", "Z2", "p"),
			row("ass", "ASSUMPTION", "Z3", "p"),
			row("jus", "JUSTIFICATION", "Z4", "p"),
			row("con", "CONTRACT", "Z5", "p"),
			away("ag", "AG1", "p"),
			module_("mod", "M1", "p"),
		];
		for (let seed = 1; seed <= 30; seed++) {
			const tree = buildTreeFromElements(seededShuffle(rows, seed));
			const children = descend(tree, "p").children ?? [];
			const position = (id: string) => children.findIndex((n) => n.id === id);
			const later = ["e", "ag", "mod"];
			for (const earlier of ["cg", "ctx", "ass", "jus", "con"]) {
				for (const id of later) {
					expect(position(earlier), `${earlier} before ${id}`).toBeLessThan(
						position(id)
					);
				}
			}
			expect(position("e")).toBeLessThan(position("ag"));
			expect(position("e")).toBeLessThan(position("mod"));
			expect(position("ag")).toBeLessThan(position("mod"));
		}
	});
});

describe("the root of the tree", () => {
	it("is the first parentless goal in the same order, whatever order the rows come in", () => {
		const rows = [
			goal("g10", "G10"),
			goal("g2", "G2"),
			goal("g1", "G1"),
			claim("p1", "P1", "g1"),
			claim("p2", "P2", "g2"),
		];
		for (const order of allOrders(rows)) {
			expect(buildTreeFromElements(order).id).toBe("g1");
		}
	});

	it("is a top-level goal ahead of an unnamed stray goal, whatever the row order", () => {
		const rows = [
			row("stray-missing", "GOAL", null, null),
			row("stray-empty", "GOAL", "", null),
			row("top", "GOAL", "G5", null, { role: "TOP_LEVEL" }),
			claim("p", "P1", "top"),
		];
		for (const order of allOrders(rows)) {
			const tree = buildTreeFromElements(order);
			expect(tree.id).toBe("top");
			expect(names(tree.children)).toEqual(["P1"]);
		}
	});

	it("is the first of several top-level goals in name order when strays are present", () => {
		const rows = [
			row("stray", "GOAL", null, null),
			row("t10", "GOAL", "G10", null, { role: "TOP_LEVEL" }),
			row("t2", "GOAL", "G2", null, { role: "TOP_LEVEL" }),
			row("sup", "GOAL", "G1", null, { role: "SUPPORTING" }),
		];
		for (const order of allOrders(rows)) {
			expect(buildTreeFromElements(order).id).toBe("t2");
		}
	});

	it("falls back to the id when parentless goals share a name", () => {
		const rows = [goal("gb", "G1"), goal("ga", "G1"), goal("gc", "G1")];
		for (const order of allOrders(rows)) {
			expect(buildTreeFromElements(order).id).toBe("ga");
		}
	});

	it("is never a counter-goal while an ordinary goal exists", () => {
		const rows = [
			counter("c0", "G0", null),
			goal("g9", "G9"),
			counter("c1", "G1", null),
		];
		for (const order of allOrders(rows)) {
			expect(buildTreeFromElements(order).id).toBe("g9");
		}
	});

	it("is the first counter-goal in order when counter-goals are all there is", () => {
		const rows = [
			counter("c10", "G10", null),
			counter("c2", "G2", null),
			counter("c1", "G1", null),
		];
		for (const order of allOrders(rows)) {
			expect(buildTreeFromElements(order).id).toBe("c1");
		}
	});

	it("is the same element in every arrangement when there is no goal at all", () => {
		const rows = [
			claim("p2", "P2", "nowhere"),
			row("p2b", "PROPERTY_CLAIM", "P2", null),
			row("p1", "PROPERTY_CLAIM", "P1", null),
			evidence("e1", "E1"),
			row("s1", "STRATEGY", "S1", null),
			row("ag", "AWAY_GOAL", "AG1", null),
		];
		const reference = buildTreeFromElements(rows);
		for (let seed = 1; seed <= 60; seed++) {
			expect(buildTreeFromElements(seededShuffle(rows, seed)).id).toBe(
				reference.id
			);
		}
		for (const order of allOrders(rows.slice(1))) {
			expect(
				buildTreeFromElements([rows[0] as ElementWithLinks, ...order]).id
			).toBe(reference.id);
		}
	});
});

describe("evidence that more than one claim links", () => {
	function sharedCase() {
		const shared = evidence("shared", "E1");
		return [
			goal("g"),
			link(claim("p2", "P2", "g"), shared),
			link(claim("p10", "P10", "g"), shared),
			link(claim("p1", "P1", "g"), evidence("other", "E2")),
			shared,
			evidence("other", "E2"),
			counter("c2", "G2", "shared"),
			counter("c1", "G1", "shared"),
		];
	}

	it("gives its counter-goals to the first copy in the written tree, whatever the row order", () => {
		for (let seed = 1; seed <= 60; seed++) {
			const tree = buildTreeFromElements(seededShuffle(sharedCase(), seed));
			expect(names(descend(tree, "p2", "shared").children)).toEqual([
				"G1",
				"G2",
			]);
			expect(descend(tree, "p10", "shared").children).toEqual([]);
		}
	});

	it("gives them to the first copy in the written tree, wherever that copy sits", () => {
		const shared = evidence("shared", "E1");
		const rows = [
			goal("g"),
			// linked straight to P1 and also to a claim beneath P1 that comes first
			link(claim("p1", "P1", "g"), shared),
			link(claim("p1.1", "P1.1", "p1"), shared),
			shared,
			counter("c", "G1", "shared"),
		];
		for (let seed = 1; seed <= 60; seed++) {
			const tree = buildTreeFromElements(seededShuffle(rows, seed));
			const copies: TreeNode[] = [];
			walk(tree, (node) => {
				if (node.id === "shared") {
					copies.push(node);
				}
			});
			expect(copies.length).toBe(2);
			expect(copies[0]?.children?.length).toBe(1);
			expect(copies[1]?.children).toEqual([]);
			// the claim P1.1 sorts before the evidence beside it, so its copy is first
			expect(descend(tree, "p1", "p1.1", "shared").children?.length).toBe(1);
			expect(descend(tree, "p1", "shared").children).toEqual([]);
		}
	});

	it("never repeats a copy's counter-goals when the same piece of evidence is deep and shallow", () => {
		const shared = evidence("shared", "E1");
		const rows = [
			goal("g"),
			link(claim("a", "P3", "g"), shared),
			link(claim("b", "P2", "g"), shared),
			link(claim("c", "P1", "g"), shared),
			link(claim("d", "P1.1", "c"), shared),
			shared,
			counter("x", "G1", "shared"),
			counter("y", "G2", "shared"),
		];
		const reference = buildTreeFromElements(rows);
		let withChildren = 0;
		walk(reference, (node) => {
			if (node.id === "shared" && (node.children?.length ?? 0) > 0) {
				withChildren++;
			}
		});
		expect(withChildren).toBe(1);
		for (let seed = 1; seed <= 60; seed++) {
			expect(buildTreeFromElements(seededShuffle(rows, seed))).toEqual(
				reference
			);
		}
		// the first claim in order is P1, and the claim beneath it, P1.1, is met before its evidence
		expect(descend(reference, "c", "d", "shared").children?.length).toBe(2);
	});
});

describe("building the tree does not disturb its input", () => {
	it("leaves the rows and every evidence list in the order given, and works on frozen input", () => {
		const e = [evidence("e2", "E2"), evidence("e1", "E1")];
		const rows = [
			goal("g"),
			link(claim("p2", "P2", "g"), ...e),
			claim("p1", "P1", "g"),
			...e,
		];
		for (const r of rows) {
			Object.freeze(r);
			if (r.evidenceLinksTo) {
				for (const l of r.evidenceLinksTo) {
					Object.freeze(l);
					Object.freeze(l.evidence);
				}
				Object.freeze(r.evidenceLinksTo);
			}
		}
		Object.freeze(rows);
		const before = JSON.stringify(rows);
		const tree = buildTreeFromElements(rows);
		expect(names(tree.children)).toEqual(["P1", "P2"]);
		expect(JSON.stringify(rows)).toBe(before);
	});

	it("does not carry its order from one call to the next", () => {
		const rows = [goal("g"), claim("b", "P2", "g"), claim("a", "P1", "g")];
		const first = buildTreeFromElements(rows);
		const second = buildTreeFromElements([...rows].reverse());
		const third = buildTreeFromElements(rows);
		expect(second).toEqual(first);
		expect(third).toEqual(first);
	});
});

describe("many siblings", () => {
	it("orders thousands of children naturally, from any starting order", () => {
		const claims = Array.from({ length: 3000 }, (_, i) =>
			claim(`id-${3000 - i}`, `P${3000 - i}`, "g")
		);
		for (const seed of [1, 2]) {
			const tree = buildTreeFromElements(
				seededShuffle([goal("g"), ...claims], seed)
			);
			const written = names(tree.children);
			const firstWrong = written.findIndex((name, i) => name !== `P${i + 1}`);
			expect(written.length).toBe(3000);
			expect(firstWrong).toBe(-1);
		}
	});
});
