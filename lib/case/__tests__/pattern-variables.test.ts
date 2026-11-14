import { describe, expect, it } from "vitest";
import {
	type PatternVariable,
	patternVariables,
	setVariableValues,
} from "../pattern-variables";

const SYSTEM_ID = "k3f9x2m7qa";
const OWNER_ID = "p4n8c2d6xz";
const WINDOW_ID = "q1w2e3r4t5";

type Plain = Record<string, unknown>;

function node(id: string, fields: Plain = {}, children: Plain[] = []): Plain {
	return { id, name: id, type: "GOAL", description: "", children, ...fields };
}

function file(tree: Plain): Plain {
	return { version: "1.1", case: { name: "A pattern" }, tree };
}

const system = {
	id: SYSTEM_ID,
	name: "system",
	text: "The system",
	variable: true,
};
const owner = {
	id: OWNER_ID,
	name: "owner",
	text: "Who owns it",
	variable: true,
};

describe("patternVariables", () => {
	it("lists the variables on any element, in tree order, with name and meaning", () => {
		const pattern = file(
			node("g1", { context: [system] }, [
				node("s1", {}, [node("p1", { context: [owner] })]),
			])
		);

		expect(patternVariables(pattern)).toEqual<PatternVariable[]>([
			{ id: SYSTEM_ID, name: "system", meaning: "The system" },
			{ id: OWNER_ID, name: "owner", meaning: "Who owns it" },
		]);
	});

	it("leaves out plain context lines and named entries that are not variables", () => {
		const pattern = file(
			node("g1", {
				context: [
					"A plain line",
					{
						id: WINDOW_ID,
						name: "window",
						text: "An interval",
						value: "5 min",
					},
					{ id: OWNER_ID, name: "owner", text: "Not one", variable: false },
					system,
				],
			})
		);

		expect(patternVariables(pattern).map((v) => v.id)).toEqual([SYSTEM_ID]);
	});

	it("gives a value only when it is not blank, trimmed as it is shown", () => {
		const pattern = file(
			node("g1", {
				context: [
					{ ...system, value: "  AcmeBot  " },
					{ ...owner, value: "   " },
				],
			})
		);

		expect(patternVariables(pattern)).toEqual([
			{
				id: SYSTEM_ID,
				name: "system",
				meaning: "The system",
				value: "AcmeBot",
			},
			{ id: OWNER_ID, name: "owner", meaning: "Who owns it" },
		]);
	});

	it("gives no value for one of only zero-width characters", () => {
		const pattern = file(
			node("g1", {
				context: [{ ...system, value: "\u200B\u200C\u200D\u2060" }],
			})
		);

		expect(patternVariables(pattern)).toEqual([
			{ id: SYSTEM_ID, name: "system", meaning: "The system" },
		]);
	});

	it("shows references in a meaning as they are shown in the case, and a value as it is", () => {
		const pattern = file(
			node("g1", {
				context: [
					{ id: WINDOW_ID, name: "window", text: "An interval" },
					{
						...system,
						text: `Run over {window#${WINDOW_ID}} by {owner#${OWNER_ID}}`,
						value: `{owner#${OWNER_ID}} <b>bold</b>`,
					},
					owner,
				],
			})
		);

		expect(patternVariables(pattern)[0]).toEqual({
			id: SYSTEM_ID,
			name: "system",
			meaning: "Run over {window} by [owner]",
			value: `{owner#${OWNER_ID}} <b>bold</b>`,
		});
	});

	it.each([
		["nothing", undefined],
		["a string", "text"],
		["a file with no tree", { version: "1.1" }],
		["a tree that is not a record", { tree: [] }],
		["children that are not a list", { tree: { id: "g", children: "x" } }],
		["a context that is not a list", { tree: { id: "g", context: {} } }],
	])("finds no variables in %s", (_label, input) => {
		expect(patternVariables(input)).toEqual([]);
	});
});

describe("setVariableValues", () => {
	const pattern = file(
		node("g1", { context: [{ ...system, value: "Old" }, owner] }, [
			node("s1", { context: [{ id: WINDOW_ID, name: "window", text: "w" }] }),
		])
	);

	function contextOf(result: unknown, path: number[] = []): unknown {
		let current = (result as Plain).tree as Plain;
		for (const index of path) {
			current = (current.children as Plain[])[index] as Plain;
		}
		return current.context;
	}

	it("sets the given values, trimmed, and leaves other variables as they are", () => {
		const result = setVariableValues(
			pattern,
			new Map([[OWNER_ID, "  Dana  "]])
		);

		expect(contextOf(result)).toEqual([
			{ ...system, value: "Old" },
			{ ...owner, value: "Dana" },
		]);
	});

	it("leaves a variable without a value when the value is empty", () => {
		const result = setVariableValues(
			pattern,
			new Map([
				[SYSTEM_ID, ""],
				[OWNER_ID, "   "],
			])
		);

		expect(contextOf(result)).toEqual([system, owner]);
	});

	it("leaves a variable without a value when the value is only zero-width characters", () => {
		const result = setVariableValues(
			pattern,
			new Map([[SYSTEM_ID, " \u200B\u2060 "]])
		);

		expect(contextOf(result)).toEqual([system, owner]);
	});

	it("stores a value as entered, never as a reference or markup", () => {
		const entered = `{window#${WINDOW_ID}} <script>x</script> [owner]`;

		const result = setVariableValues(pattern, new Map([[OWNER_ID, entered]]));

		expect((contextOf(result) as Plain[])[1]).toEqual({
			...owner,
			value: entered,
		});
	});

	it("changes only a variable: an entry that is not one keeps its value", () => {
		const result = setVariableValues(pattern, new Map([[WINDOW_ID, "x"]]));

		expect(contextOf(result, [0])).toEqual([
			{ id: WINDOW_ID, name: "window", text: "w" },
		]);
	});

	it("returns a copy and leaves the file it was given alone", () => {
		const before = JSON.stringify(pattern);

		const result = setVariableValues(pattern, new Map([[OWNER_ID, "Dana"]]));

		expect(JSON.stringify(pattern)).toBe(before);
		expect(result).not.toBe(pattern);
	});

	it("returns a value that is not a record as it is", () => {
		expect(setVariableValues("text", new Map([[OWNER_ID, "x"]]))).toBe("text");
	});
});
