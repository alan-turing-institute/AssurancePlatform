import { describe, expect, it } from "vitest";
import type { TreeNode } from "@/lib/schemas/case-export";
import {
	countPlaceholders,
	countUnsetVariables,
	countUnsetVariablesOnCards,
	fillInCountMessage,
	patternMarkersForEdit,
	placeholderCountMessage,
	recordedStates,
	unsetVariableCountMessage,
	writingClearsPlaceholder,
} from "../placeholders";

describe("placeholderCountMessage", () => {
	it("agrees with the number", () => {
		expect(placeholderCountMessage(1)).toBe("1 element still to fill in");
		expect(placeholderCountMessage(3)).toBe("3 elements still to fill in");
	});
});

describe("the words for what is left to fill in", () => {
	it("agree with the number of variables", () => {
		expect(unsetVariableCountMessage(1)).toBe("1 variable with no value");
		expect(unsetVariableCountMessage(2)).toBe("2 variables with no value");
	});

	it("give each count that is left, and nothing when none is", () => {
		expect(fillInCountMessage({ placeholders: 2, unsetVariables: 0 })).toBe(
			"2 elements still to fill in"
		);
		expect(fillInCountMessage({ placeholders: 0, unsetVariables: 1 })).toBe(
			"1 variable with no value"
		);
		expect(fillInCountMessage({ placeholders: 1, unsetVariables: 3 })).toBe(
			"1 element still to fill in; 3 variables with no value"
		);
		expect(fillInCountMessage({ placeholders: 0, unsetVariables: 0 })).toBe("");
	});
});

describe("countUnsetVariables", () => {
	const SYSTEM = "sysaaaaaaa";
	const RATE = "rateaaaaaa";

	function node(
		id: string,
		fields: Partial<TreeNode>,
		children: TreeNode[] = []
	): TreeNode {
		return {
			id,
			type: "PROPERTY_CLAIM",
			name: id,
			description: "",
			inSandbox: false,
			children,
			...fields,
		};
	}

	const root = (children: TreeNode[], value?: string) =>
		node(
			"g1",
			{
				type: "GOAL",
				context: [
					{ id: SYSTEM, name: "system", text: "", variable: true, value },
					{ id: RATE, name: "rate", text: "", variable: true },
					{ id: "winaaaaaaa", name: "window", text: "", value: "" },
				],
			},
			children
		);

	it("counts each variable with no value once, however often and wherever it is mentioned", () => {
		const tree = root([
			node("p1", { description: `On {s#${SYSTEM}} and {r#${RATE}}` }),
			node("p2", { assumption: `{s#${SYSTEM}}` }, [
				node("e1", { description: `{s#${SYSTEM}}`, type: "EVIDENCE" }),
			]),
		]);

		expect(countUnsetVariables(tree)).toBe(2);
	});

	it("leaves out a variable nobody mentions, one that has a value, and an ordinary term", () => {
		const tree = root(
			[node("p1", { description: `{s#${SYSTEM}} {w#winaaaaaaa}` })],
			"AcmeBot"
		);

		expect(countUnsetVariables(tree)).toBe(0);
	});

	it("leaves out a mention made where the variable is out of reach", () => {
		const tree = node("g1", { type: "GOAL" }, [
			node("s2", {
				context: [{ id: SYSTEM, name: "system", text: "", variable: true }],
			}),
			node("p1", { description: `{s#${SYSTEM}}` }),
		]);

		expect(countUnsetVariables(tree)).toBe(0);
	});

	it("counts the same on the cards of the open diagram, which carry their terms in reach", () => {
		const terms = [
			{
				id: SYSTEM,
				name: "system",
				text: "",
				variable: true,
				definedOn: { elementId: "g1", elementName: "G1" },
			},
		];

		expect(
			countUnsetVariablesOnCards([
				{ description: `On {s#${SYSTEM}}`, termsInReach: terms },
				{ description: `Again {s#${SYSTEM}}`, termsInReach: terms },
				{ description: `{s#${SYSTEM}}`, termsInReach: [] },
				{ description: `{s#${SYSTEM}}`, termsInReach: "garbage" },
				undefined,
			])
		).toBe(1);
	});
});

describe("countPlaceholders", () => {
	it("counts an element listed more than once as one", () => {
		const count = countPlaceholders([
			{ id: "e1", isPlaceholder: true },
			{ id: "e1", isPlaceholder: true },
			{ id: "p1", isPlaceholder: false },
			{ id: "p2" },
		]);

		expect(count).toBe(1);
	});
});

describe("writingClearsPlaceholder", () => {
	it.each([
		["new text in a case", "CASE", "", "Written", true],
		["new text in a pattern", "PATTERN", "", "Written", false],
		["the stored text again", "CASE", "Same", "Same", false],
		["empty text", "CASE", "Sample", "  ", false],
		["no text at all", "CASE", "", undefined, false],
	] as const)("%s: %s", (_label, kind, stored, written, expected) => {
		expect(writingClearsPlaceholder(kind, stored, written)).toBe(expected);
	});
});

describe("patternMarkersForEdit", () => {
	const stored = {
		description: "Sample",
		assumption: null,
		justification: null,
		context: [],
		fromPattern: true,
	};

	it("marks an element from a pattern as modified for changed text only", () => {
		const base = { kind: "CASE", placeholderSetByEdit: false, stored } as const;

		expect(
			patternMarkersForEdit({
				...base,
				edit: { description: "Sample", context: [] },
			})
		).toEqual({});
		expect(
			patternMarkersForEdit({ ...base, edit: { justification: "Because" } })
		).toEqual({ modifiedFromPattern: true });
		expect(
			patternMarkersForEdit({ ...base, edit: { context: ["A named thing"] } })
		).toEqual({ modifiedFromPattern: true });
	});

	it("leaves the placeholder marker to an edit that sets it", () => {
		const input = {
			kind: "CASE",
			stored: { ...stored, fromPattern: false },
			edit: { description: "Written" },
		} as const;

		expect(
			patternMarkersForEdit({ ...input, placeholderSetByEdit: false })
		).toEqual({ isPlaceholder: false });
		expect(
			patternMarkersForEdit({ ...input, placeholderSetByEdit: true })
		).toEqual({});
	});
});

describe("recordedStates", () => {
	const before = { id: "e1", description: "", isPlaceholder: true };

	it("records a placeholder as cleared once its description is written in a case", () => {
		const recorded = recordedStates("CASE", before, { description: "Written" });

		expect(recorded.before).toBe(before);
		expect(recorded.after).toEqual({
			id: "e1",
			description: "Written",
			isPlaceholder: false,
		});
	});

	it("records the marker as it stands in a pattern, spelling out the state before", () => {
		const recorded = recordedStates(
			"PATTERN",
			{ id: "e1", description: "Sample" },
			{ description: "Edited", isPlaceholder: true, placeholderHint: "Hint" }
		);

		expect(recorded.before).toMatchObject({
			isPlaceholder: false,
			placeholderHint: null,
		});
		expect(recorded.after).toMatchObject({
			isPlaceholder: true,
			placeholderHint: "Hint",
		});
	});
});
