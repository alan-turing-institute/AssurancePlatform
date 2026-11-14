import type { Node } from "reactflow";
import { describe, expect, it } from "vitest";
import { getAssertionStatusIndicator } from "@/components/shared/nodes/assertion-status-badge";
import { convertAssuranceCase } from "../convert-case";
import { isUnsupported } from "../unsupported";

/**
 * The rule is tried on the nodes the canvas really holds: every case below is
 * built as the API would return it and put through `convertAssuranceCase`, so
 * the node kinds, the parent links, the repeated entries for shared evidence
 * and the side attachment of defeaters are the canvas's own, not hand-made.
 */

type Item = Record<string, unknown>;

const goal = (id: string, extra: Item = {}): Item => ({
	id,
	name: id,
	type: "TopLevelNormativeGoal",
	...extra,
});
const strategy = (id: string, extra: Item = {}): Item => ({
	id,
	name: id,
	type: "Strategy",
	...extra,
});
const claim = (id: string, extra: Item = {}): Item => ({
	id,
	name: id,
	type: "PropertyClaim",
	...extra,
});
const evidence = (id: string, extra: Item = {}): Item => ({
	id,
	name: id,
	type: "Evidence",
	...extra,
});
const awayGoal = (id: string, extra: Item = {}): Item => ({
	id,
	name: id,
	type: "AwayGoal",
	...extra,
});
const module = (id: string, extra: Item = {}): Item => ({
	id,
	name: id,
	type: "Module",
	...extra,
});

function nodesOf(...goals: Item[]): Node[] {
	return convertAssuranceCase({ goals } as never).caseNodes;
}

/** Every node id the rule marks, in canvas order. */
function marked(nodes: Node[]): string[] {
	return nodes.filter((n) => isUnsupported(nodes, n.id)).map((n) => n.id);
}

describe("isUnsupported on the nodes the canvas holds", () => {
	describe("where the marker sits", () => {
		it("marks a lone top goal", () => {
			expect(marked(nodesOf(goal("g")))).toEqual(["goal-g"]);
		});

		it("marks an empty strategy and not the goal above it", () => {
			expect(
				marked(nodesOf(goal("g", { strategies: [strategy("s")] })))
			).toEqual(["strategy-s"]);
		});

		it("marks only the element at the bottom of a chain, never its ancestors", () => {
			const nodes = nodesOf(
				goal("g", {
					strategies: [
						strategy("s", {
							propertyClaims: [claim("p1", { propertyClaims: [claim("p2")] })],
						}),
					],
				})
			);

			expect(marked(nodes)).toEqual(["property-p2"]);
		});

		it("marks each branch that stops, and only those", () => {
			const nodes = nodesOf(
				goal("g", {
					propertyClaims: [
						claim("done", { evidence: [evidence("e")] }),
						claim("open-a"),
						claim("open-b", { propertyClaims: [claim("deeper")] }),
					],
				})
			);

			expect(marked(nodes)).toEqual(["property-open-a", "property-deeper"]);
		});

		it("answers false for an id that is not on the canvas", () => {
			const nodes = nodesOf(goal("g"));

			expect(isUnsupported(nodes, "goal-missing")).toBe(false);
			expect(isUnsupported([], "goal-g")).toBe(false);
		});
	});

	describe("what counts as support", () => {
		const TWO_LEVELS: [string, string, Item, string, Item][] = [
			["a goal", "goal", goal("p"), "a strategy", strategy("c")],
			["a goal", "goal", goal("p"), "a claim", claim("c")],
			["a goal", "goal", goal("p"), "an away goal", awayGoal("c")],
			["a goal", "goal", goal("p"), "a module", module("c")],
			["a strategy", "strategy", strategy("p"), "a claim", claim("c")],
			["a strategy", "strategy", strategy("p"), "an away goal", awayGoal("c")],
			["a strategy", "strategy", strategy("p"), "a module", module("c")],
			["a claim", "property", claim("p"), "a claim", claim("c")],
			["a claim", "property", claim("p"), "a strategy", strategy("c")],
			["a claim", "property", claim("p"), "evidence", evidence("c")],
			["a claim", "property", claim("p"), "an away goal", awayGoal("c")],
			["a claim", "property", claim("p"), "a module", module("c")],
		];

		function treeWithChild(parentKind: string, parent: Item, child: Item) {
			const withChild = { ...parent, [childKeyOf(child)]: [child] };
			if (parentKind === "goal") {
				return nodesOf(withChild);
			}
			if (parentKind === "strategy") {
				return nodesOf(goal("top", { strategies: [withChild] }));
			}
			return nodesOf(goal("top", { propertyClaims: [withChild] }));
		}

		it.each(
			TWO_LEVELS
		)("%s with %s beneath it is not marked", (_parentLabel, parentKind, parent, _childLabel, child) => {
			const nodes = treeWithChild(parentKind, parent, child);

			expect(isUnsupported(nodes, `${parentKind}-p`)).toBe(false);
		});

		it.each([
			["evidence", evidence("c")],
			["an away goal", awayGoal("c")],
			["a module", module("c")],
		])("%s is never marked, however little is beneath it", (_label, child) => {
			const nodes = nodesOf(
				goal("g", {
					propertyClaims: [claim("p", { [childKeyOf(child)]: [child] })],
				})
			);

			const id = nodes.find((n) => n.data.id === "c")?.id;
			expect(id).toBeDefined();
			expect(isUnsupported(nodes, id as string)).toBe(false);
		});

		it("counts an away goal whose link to the other case is broken", () => {
			const nodes = nodesOf(
				goal("g", {
					propertyClaims: [
						claim("a", {
							awayGoals: [awayGoal("away-null", { citedElementId: null })],
						}),
						claim("b", {
							awayGoals: [
								awayGoal("away-gone", {
									citedElementId: "no-such-element",
									cited_case_id: "no-such-case",
								}),
							],
						}),
					],
				})
			);

			expect(marked(nodes)).toEqual([]);
		});

		it("counts a module whose link to the other module is broken", () => {
			const nodes = nodesOf(
				goal("g", {
					propertyClaims: [
						claim("a", {
							modules: [module("mod-null", { moduleReferenceId: null })],
						}),
						claim("b", {
							modules: [
								module("mod-gone", { moduleReferenceId: "no-such-module" }),
							],
						}),
					],
				})
			);

			expect(marked(nodes)).toEqual([]);
		});

		it("counts children that are hidden because the branch is collapsed", () => {
			const nodes = nodesOf(
				goal("g", {
					propertyClaims: [
						claim("p", {
							hidden: false,
							evidence: [evidence("e1", { hidden: true })],
							propertyClaims: [claim("p2", { hidden: true })],
						}),
					],
				})
			);

			expect(nodes.find((n) => n.id === "evidence-e1")?.hidden).toBe(true);
			expect(isUnsupported(nodes, "property-p")).toBe(false);
		});

		it("counts a claim whose only child is a collapsed piece of evidence", () => {
			const nodes = nodesOf(
				goal("g", {
					propertyClaims: [
						claim("p", { evidence: [evidence("e", { hidden: true })] }),
					],
				})
			);

			expect(marked(nodes)).toEqual([]);
		});
	});

	describe("defeaters are not support", () => {
		const DEFEATER_KINDS: [
			string,
			(id: string, extra?: Item) => Item,
			string,
		][] = [
			["a claim", claim, "propertyClaims"],
			["a piece of evidence", evidence, "evidence"],
			["an away goal", awayGoal, "awayGoals"],
			["a module", module, "modules"],
		];

		it.each(
			DEFEATER_KINDS
		)("a claim whose only child is %s that is a defeater is marked", (_label, make, key) => {
			const nodes = nodesOf(
				goal("g", {
					propertyClaims: [
						claim("p", {
							[key]: [make("d", { isDefeater: true, defeatsElementId: "p" })],
						}),
					],
				})
			);

			expect(isUnsupported(nodes, "property-p")).toBe(true);
		});

		it.each(
			DEFEATER_KINDS
		)("the defeater itself, %s, is never marked", (_label, make, key) => {
			const nodes = nodesOf(
				goal("g", {
					propertyClaims: [
						claim("p", {
							[key]: [make("d", { isDefeater: true, defeatsElementId: "p" })],
						}),
					],
				})
			);

			const defeater = nodes.find((n) => n.data.id === "d");
			expect(defeater?.data.isDefeater).toBe(true);
			expect(isUnsupported(nodes, defeater?.id as string)).toBe(false);
		});

		it("a goal whose only child is a defeater claim is marked", () => {
			const nodes = nodesOf(
				goal("g", {
					propertyClaims: [
						claim("d", { isDefeater: true, defeatsElementId: "g" }),
					],
				})
			);

			expect(isUnsupported(nodes, "goal-g")).toBe(true);
		});

		it("a defeater beside real support does not take the support away", () => {
			const nodes = nodesOf(
				goal("g", {
					propertyClaims: [
						claim("p", {
							evidence: [evidence("e")],
							propertyClaims: [
								claim("d", { isDefeater: true, defeatsElementId: "p" }),
							],
						}),
					],
				})
			);

			expect(isUnsupported(nodes, "property-p")).toBe(false);
		});

		it("one defeater among several children is skipped, and a later real child still counts", () => {
			const nodes = nodesOf(
				goal("g", {
					propertyClaims: [
						claim("p", {
							propertyClaims: [
								claim("d", { isDefeater: true, defeatsElementId: "p" }),
								claim("real"),
							],
						}),
					],
				})
			);

			expect(isUnsupported(nodes, "property-p")).toBe(false);
		});

		it("a defeater drawn beside the element it challenges counts for its tree parent only", () => {
			// d hangs under y in the tree but challenges x, so the canvas draws it to
			// the side of x. It supports neither: not x (not its parent) and not y (a
			// defeater is a challenge).
			const nodes = nodesOf(
				goal("g", {
					propertyClaims: [
						claim("x"),
						claim("y", {
							propertyClaims: [
								claim("d", { isDefeater: true, defeatsElementId: "x" }),
							],
						}),
					],
				})
			);

			const d = nodes.find((n) => n.id === "property-d");
			expect(d?.data.attachedTo).toBe("property-x");
			expect(d?.data.parentId).toBe("property-y");
			expect(marked(nodes)).toEqual(["property-x", "property-y"]);
		});

		it("a defeater drawn beside a supported element leaves the element unmarked", () => {
			const nodes = nodesOf(
				goal("g", {
					propertyClaims: [
						claim("x", { evidence: [evidence("e")] }),
						claim("y", {
							evidence: [evidence("e2")],
							propertyClaims: [
								claim("d", { isDefeater: true, defeatsElementId: "x" }),
							],
						}),
					],
				})
			);

			expect(marked(nodes)).toEqual([]);
		});

		it("evidence that is a defeater of one claim does not support the claim it hangs under", () => {
			const nodes = nodesOf(
				goal("g", {
					propertyClaims: [
						claim("x"),
						claim("y", {
							evidence: [
								evidence("de", { isDefeater: true, defeatsElementId: "x" }),
							],
						}),
					],
				})
			);

			expect(marked(nodes)).toEqual(["property-x", "property-y"]);
		});
	});

	describe("the status the author set", () => {
		function emptyClaim(status: unknown) {
			return nodesOf(
				goal("g", { propertyClaims: [claim("x", { assertionStatus: status })] })
			);
		}

		it.each([
			"ASSERTED",
			"NEEDS_SUPPORT",
			"ASSUMED",
			"AXIOMATIC",
			"DEFEATED",
			"AS_CITED",
			null,
			undefined,
			"",
			"BOGUS",
			"assumed",
			7,
			{},
			[],
		])("the marker and the status badge never both apply to an empty claim, status %j", (status) => {
			const nodes = emptyClaim(status);
			const unsupported = isUnsupported(nodes, "property-x");
			const badgeShown = getAssertionStatusIndicator(status) !== null;

			expect(unsupported).not.toBe(badgeShown);
		});

		it("the status of a supported element has no bearing on the child that supports it", () => {
			const nodes = nodesOf(
				goal("g", {
					assertionStatus: "ASSUMED",
					propertyClaims: [claim("p", { assertionStatus: "ASSERTED" })],
				})
			);

			expect(marked(nodes)).toEqual(["property-p"]);
		});

		it("a child with an explaining status still counts as support for its parent", () => {
			const nodes = nodesOf(
				goal("g", {
					propertyClaims: [claim("p", { assertionStatus: "NEEDS_SUPPORT" })],
				})
			);

			expect(marked(nodes)).toEqual([]);
		});
	});

	describe("evidence shared by two claims", () => {
		it("is held twice by the canvas, once under each claim", () => {
			const nodes = nodesOf(
				goal("g", {
					propertyClaims: [
						claim("a", { evidence: [evidence("shared")] }),
						claim("b", { evidence: [evidence("shared")] }),
					],
				})
			);

			const entries = nodes.filter((n) => n.id === "evidence-shared");
			expect(entries.map((n) => n.data.parentId)).toEqual([
				"property-a",
				"property-b",
			]);
		});

		it("supports both claims", () => {
			const nodes = nodesOf(
				goal("g", {
					propertyClaims: [
						claim("a", { evidence: [evidence("shared")] }),
						claim("b", { evidence: [evidence("shared")] }),
					],
				})
			);

			expect(marked(nodes)).toEqual([]);
		});

		it("supports the second claim even when the first entry was seen before it", () => {
			const nodes = nodesOf(
				goal("g", {
					propertyClaims: [
						claim("a", { evidence: [evidence("shared")] }),
						claim("b", { evidence: [evidence("shared")] }),
					],
				})
			).reverse();

			expect(isUnsupported(nodes, "property-b")).toBe(false);
			expect(isUnsupported(nodes, "property-a")).toBe(false);
		});

		it("marks a claim again once its entry for the shared evidence is gone", () => {
			const nodes = nodesOf(
				goal("g", {
					propertyClaims: [
						claim("a", { evidence: [evidence("shared")] }),
						claim("b", { evidence: [evidence("shared")] }),
					],
				})
			);
			const withoutB = nodes.filter(
				(n) => !(n.id === "evidence-shared" && n.data.parentId === "property-b")
			);

			expect(marked(withoutB)).toEqual(["property-b"]);
		});

		it("the repeated evidence is not itself marked", () => {
			const nodes = nodesOf(
				goal("g", {
					propertyClaims: [
						claim("a", { evidence: [evidence("shared")] }),
						claim("b", { evidence: [evidence("shared")] }),
					],
				})
			);

			expect(isUnsupported(nodes, "evidence-shared")).toBe(false);
		});
	});

	describe("data the canvas should never hold, but the rule must survive", () => {
		const bare = (over: Partial<Node> & { id: string }): Node =>
			({ position: { x: 0, y: 0 }, data: {}, ...over }) as Node;

		it("does not throw on nodes with no data, null data or no type", () => {
			const nodes = [
				bare({ id: "goal-g", type: "goal" }),
				bare({ id: "no-data", type: "property", data: undefined as never }),
				bare({ id: "null-data", type: "property", data: null as never }),
				bare({ id: "no-type", data: { parentId: "goal-g" } }),
			];

			expect(() => nodes.map((n) => isUnsupported(nodes, n.id))).not.toThrow();
		});

		it("does not count a child with no type", () => {
			const nodes = [
				bare({ id: "goal-g", type: "goal" }),
				bare({ id: "mystery", data: { parentId: "goal-g" } }),
			];

			expect(isUnsupported(nodes, "goal-g")).toBe(true);
		});

		it("does not count a child of a kind that is not support", () => {
			const nodes = [
				bare({ id: "goal-g", type: "goal" }),
				bare({
					id: "context-1",
					type: "context",
					data: { parentId: "goal-g" },
				}),
				bare({ id: "goal-h", type: "goal", data: { parentId: "goal-g" } }),
			];

			expect(isUnsupported(nodes, "goal-g")).toBe(true);
		});

		it("does not mark a node whose type is not a goal, strategy or claim", () => {
			const nodes = [
				bare({ id: "x", type: "context" }),
				bare({ id: "y", type: "Goal" }),
				bare({ id: "z", type: "property_claim" }),
				bare({ id: "w", type: undefined }),
			];

			expect(nodes.map((n) => isUnsupported(nodes, n.id))).toEqual([
				false,
				false,
				false,
				false,
			]);
		});

		it("does not match a parent link of another type or a near miss", () => {
			const nodes = [
				bare({ id: "property-p", type: "property" }),
				bare({
					id: "evidence-1",
					type: "evidence",
					data: { parentId: 5 as never },
				}),
				bare({
					id: "evidence-2",
					type: "evidence",
					data: { parentId: "property-p " },
				}),
				bare({
					id: "evidence-3",
					type: "evidence",
					data: { parentId: "Property-p" },
				}),
				bare({ id: "evidence-4", type: "evidence", data: { parentId: null } }),
				bare({
					id: "evidence-5",
					type: "evidence",
					data: { parentId: undefined },
				}),
			];

			expect(isUnsupported(nodes, "property-p")).toBe(true);
		});

		it("does not count a card as its own support", () => {
			const nodes = [
				bare({
					id: "property-p",
					type: "property",
					data: { parentId: "property-p" },
				}),
			];

			expect(isUnsupported(nodes, "property-p")).toBe(true);
		});

		it("treats a stray non-string status as no status", () => {
			const nodes = [
				bare({ id: "goal-g", type: "goal", data: { assertionStatus: 3 } }),
			];

			expect(isUnsupported(nodes, "goal-g")).toBe(true);
		});

		it("leaves the nodes it reads unchanged", () => {
			const nodes = nodesOf(
				goal("g", {
					propertyClaims: [
						claim("a", { evidence: [evidence("e")] }),
						claim("b"),
					],
				})
			);
			const snapshot = JSON.stringify(nodes);
			for (const n of nodes) {
				Object.freeze(n);
				Object.freeze(n.data);
			}

			marked(nodes);

			expect(JSON.stringify(nodes)).toBe(snapshot);
		});

		it("gives the same answer whatever order the nodes arrive in", () => {
			const nodes = nodesOf(
				goal("g", {
					strategies: [
						strategy("s", {
							propertyClaims: [
								claim("a", { evidence: [evidence("e")] }),
								claim("b"),
								claim("c", {
									propertyClaims: [
										claim("d", { isDefeater: true, defeatsElementId: "b" }),
									],
								}),
							],
						}),
					],
				})
			);
			const expected = [...marked(nodes)].sort();

			expect([...marked([...nodes].reverse())].sort()).toEqual(expected);
			const rotated = [...nodes.slice(3), ...nodes.slice(0, 3)];
			expect([...marked(rotated)].sort()).toEqual(expected);
		});
	});

	describe("against an independent reading of the rule over random cases", () => {
		function prng(seed: number) {
			// A linear congruential generator: the same seed gives the same cases.
			const modulus = 4_294_967_296;
			let state = seed % modulus;
			return () => {
				state = (state * 1_664_525 + 1_013_904_223) % modulus;
				return state / modulus;
			};
		}

		const STATUSES = [
			undefined,
			null,
			"ASSERTED",
			"NEEDS_SUPPORT",
			"ASSUMED",
			"AXIOMATIC",
			"DEFEATED",
			"AS_CITED",
		];
		const ALLOWED: Record<string, string[]> = {
			goal: ["strategy", "property", "awayGoal", "module"],
			strategy: ["property", "awayGoal", "module"],
			property: ["property", "evidence", "strategy", "awayGoal", "module"],
			awayGoal: [],
			module: [],
			evidence: [],
		};
		const KEY: Record<string, string> = {
			strategy: "strategies",
			property: "propertyClaims",
			evidence: "evidence",
			awayGoal: "awayGoals",
			module: "modules",
		};
		const TYPE_NAME: Record<string, string> = {
			goal: "TopLevelNormativeGoal",
			strategy: "Strategy",
			property: "PropertyClaim",
			evidence: "Evidence",
			awayGoal: "AwayGoal",
			module: "Module",
		};

		interface Built {
			expected: string[];
			item: Item;
		}

		function build(random: () => number, seed: number): Built {
			let counter = 0;
			const expected: string[] = [];

			/** One element with its own fields drawn, and no children yet. */
			function draft(kind: string, isDefeater: boolean) {
				counter += 1;
				const id = `${kind}${seed}x${counter}`;
				const item: Item = {
					id,
					name: id,
					type: TYPE_NAME[kind],
				};
				const status = STATUSES[Math.floor(random() * STATUSES.length)];
				if (status !== undefined && kind !== "evidence") {
					item.assertionStatus = status;
				}
				if (isDefeater) {
					item.isDefeater = true;
					item.defeatsElementId = null;
				}
				if (random() < 0.2) {
					item.hidden = true;
				}
				return { item, id, status };
			}

			/** The children of one kind under an element at `depth`, and how many of them support it. */
			function makeChildren(childKind: string, depth: number) {
				const count = depth >= 4 ? 0 : Math.floor(random() * 3);
				const children: Item[] = [];
				let supporting = 0;
				for (let i = 0; i < count; i += 1) {
					const childIsDefeater = random() < 0.25 && childKind !== "strategy";
					children.push(make(childKind, depth + 1, childIsDefeater));
					if (!childIsDefeater) {
						supporting += 1;
					}
				}
				return { children, supporting };
			}

			/** Whether an element of this kind and status is one the rule marks when nothing supports it. */
			function markable(kind: string, status: unknown): boolean {
				const kindCanBeMarked = ["goal", "strategy", "property"].includes(kind);
				const explained = typeof status === "string" && status !== "ASSERTED";
				return kindCanBeMarked && !explained;
			}

			function make(kind: string, depth: number, isDefeater: boolean): Item {
				const { item, id, status } = draft(kind, isDefeater);

				let supportingChildren = 0;
				for (const childKind of ALLOWED[kind] ?? []) {
					const { children, supporting } = makeChildren(childKind, depth);
					supportingChildren += supporting;
					const key = KEY[childKind];
					if (key && children.length > 0) {
						item[key] = children;
					}
				}

				if (markable(kind, status) && !isDefeater && supportingChildren === 0) {
					expected.push(`${kind}-${id}`);
				}
				return item;
			}

			return { item: make("goal", 0, false), expected };
		}

		it("agrees on 300 seeded cases, marking exactly the elements with nothing beneath them", () => {
			for (let seed = 1; seed <= 300; seed += 1) {
				const random = prng(seed);
				const { item, expected } = build(random, seed);
				const nodes = nodesOf(item);

				expect([...marked(nodes)].sort(), `seed ${seed}`).toEqual(
					[...expected].sort()
				);
			}
		});
	});
});

function childKeyOf(child: Item): string {
	switch (child.type) {
		case "Strategy":
			return "strategies";
		case "PropertyClaim":
			return "propertyClaims";
		case "Evidence":
			return "evidence";
		case "AwayGoal":
			return "awayGoals";
		default:
			return "modules";
	}
}
