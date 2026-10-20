import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { CaseExportNested, TreeNode } from "@/lib/schemas/case-export";
import type { ContextEntry } from "@/lib/schemas/context-entry";
import { computeTreeDiff } from "../tree-diff";
import { addHiddenProp, toggleHiddenForChildren } from "../tree-utils";

const ID_A = "aaaaaaaaaa";
const ID_B = "bbbbbbbbbb";

const GOAL_ID = randomUUID();
const STRATEGY_ID = randomUUID();

function caseWith(
	goalContext: unknown[],
	strategyContext: unknown[] = []
): CaseExportNested {
	const strategy: TreeNode = {
		id: STRATEGY_ID,
		type: "STRATEGY",
		name: "S1",
		description: "A strategy",
		inSandbox: false,
		context: strategyContext as ContextEntry[],
		children: [],
	};
	return {
		version: "1.1",
		exportedAt: "2026-01-01T00:00:00.000Z",
		case: { name: "Case", description: "A case" },
		tree: {
			id: GOAL_ID,
			type: "GOAL",
			name: "G1",
			description: "A goal",
			inSandbox: false,
			role: "TOP_LEVEL",
			context: goalContext as ContextEntry[],
			children: [strategy],
		},
	} as CaseExportNested;
}

function named(overrides: Record<string, unknown> = {}) {
	return {
		id: ID_A,
		name: "window",
		text: "the interval",
		value: "5",
		...overrides,
	};
}

describe("the JSON editor's diff of context entries", () => {
	it("sends no change for entries that are the same, however their keys are ordered", () => {
		const current = caseWith(
			["plain", named()],
			[named({ id: ID_B, name: "n" })]
		);
		const edited = structuredClone(current);
		// The database returns keys in its own order; a re-ordered record is the same record.
		(edited.tree.context as unknown[])[1] = {
			value: "5",
			text: "the interval",
			name: "window",
			id: ID_A,
		};
		const diff = computeTreeDiff(current, edited);
		expect(diff.changes).toEqual([]);
	});

	it("treats a missing value and an undefined value as the same", () => {
		const current = caseWith([named({ value: undefined })]);
		const edited = caseWith([
			{ id: ID_A, name: "window", text: "the interval" },
		]);
		expect(computeTreeDiff(current, edited).changes).toEqual([]);
	});

	it.each([
		["the name", { name: "renamed" }],
		["the meaning", { text: "another meaning" }],
		["the value", { value: "6" }],
		["the id", { id: ID_B }],
	])("sends the whole new list when %s of an entry changes", (_label, change) => {
		const current = caseWith(["plain", named()]);
		const edited = caseWith(["plain", named(change)]);
		const diff = computeTreeDiff(current, edited);
		expect(diff.changes).toHaveLength(1);
		expect(diff.changes[0]).toMatchObject({
			type: "update",
			elementId: GOAL_ID,
			data: { context: ["plain", named(change)] },
		});
	});

	it("sends a change when entries are reordered, or one is named or un-named", () => {
		const base = caseWith(["one", named()]);
		for (const edited of [
			caseWith([named(), "one"]),
			caseWith(["one", named().text]),
			caseWith(["one", named(), "two"]),
			caseWith([]),
		]) {
			const diff = computeTreeDiff(base, edited);
			expect(diff.changes).toHaveLength(1);
		}
	});

	it("does not touch an element whose context is unchanged when another element's changes", () => {
		const current = caseWith([named()], [named({ id: ID_B, name: "n" })]);
		const edited = caseWith([named()], [named({ id: ID_B, name: "m" })]);
		const diff = computeTreeDiff(current, edited);
		expect(diff.changes).toHaveLength(1);
		expect(diff.changes[0]).toMatchObject({
			type: "update",
			elementId: STRATEGY_ID,
		});
	});

	it("carries a created element's named entries in the create change", () => {
		const current = caseWith([]);
		const edited = caseWith([]);
		const created: TreeNode = {
			id: randomUUID(),
			type: "PROPERTY_CLAIM",
			name: "P1",
			description: "A claim",
			inSandbox: false,
			context: [named()],
			children: [],
		};
		edited.tree.children[0]?.children.push(created);
		const diff = computeTreeDiff(current, edited);
		const create = diff.changes.find((change) => change.type === "create");
		expect(create).toMatchObject({ data: { context: [named()] } });
	});
});

describe("the diagram's visibility flags", () => {
	function caseResponse() {
		return {
			id: "case",
			goals: [
				{
					id: "g",
					type: "goal",
					name: "G1",
					context: ["plain", named()],
					strategies: [
						{
							id: "s",
							type: "strategy",
							name: "S1",
							context: [named({ id: ID_B, name: "n" })],
							propertyClaims: [],
						},
					],
					propertyClaims: [],
				},
			],
		};
	}

	it("addHiddenProp writes no flag onto a context entry, whatever its kind", () => {
		const data = caseResponse();
		const before = structuredClone(data.goals[0]?.context);
		addHiddenProp(data as never);
		expect(data.goals[0]?.context).toEqual(before);
		expect(
			Object.keys((data.goals[0]?.context as unknown[])[1] as object).sort()
		).toEqual(["id", "name", "text", "value"]);
		expect(JSON.stringify(data.goals[0]?.strategies[0]?.context)).not.toContain(
			"hidden"
		);
	});

	it("toggleHiddenForChildren writes no flag onto a context entry either", () => {
		const data = caseResponse();
		addHiddenProp(data as never);
		const toggled = toggleHiddenForChildren(data as never, "g") as unknown as {
			goals: Array<{
				context: unknown[];
				strategies: Array<{ context: unknown[] }>;
			}>;
		};
		const goal = toggled.goals[0];
		expect(JSON.stringify(goal?.context)).not.toContain("hidden");
		expect(JSON.stringify(goal?.context)).not.toContain("childrenHidden");
		expect(JSON.stringify(goal?.strategies[0]?.context)).not.toContain(
			"hidden"
		);
	});
});
