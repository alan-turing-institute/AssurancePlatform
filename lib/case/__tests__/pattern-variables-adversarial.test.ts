import { describe, expect, it } from "vitest";
import { patternVariables, setVariableValues } from "../pattern-variables";

/**
 * Reading a pattern's variables from a case file, and giving them values,
 * against files that are not what an export writes: a published snapshot or a
 * stored file may hold anything, so a read must never throw and a write must
 * change nothing but the variables it was asked about.
 */

const SYSTEM = "k3f9x2m7qa";
const OWNER = "p4n8c2d6xz";
const WINDOW = "q1w2e3r4t5";

const variable = (
	id: string,
	name: string,
	text = "",
	value?: string
): Record<string, unknown> =>
	value === undefined
		? { id, name, text, variable: true }
		: { id, name, text, value, variable: true };

const file = (...context: unknown[]) => ({
	version: "1.1",
	tree: { id: "g1", name: "G1", description: "Goal", children: [], context },
});

function deepFreeze<T>(value: T): T {
	if (typeof value === "object" && value !== null) {
		for (const child of Object.values(value)) {
			deepFreeze(child);
		}
		Object.freeze(value);
	}
	return value;
}

describe("patternVariables", () => {
	it.each([
		["undefined", undefined],
		["null", null],
		["a number", 5],
		["text", "a case"],
		["an array", [file(variable(SYSTEM, "system"))]],
		["an empty object", {}],
		["a file with no tree", { version: "1.1" }],
		["a tree that is null", { tree: null }],
		["a tree that is text", { tree: "x" }],
		["a tree that is an array", { tree: [] }],
		["children that are not a list", { tree: { children: "x", context: "y" } }],
		[
			"children that are not objects",
			{ tree: { children: [null, 5, "x", [], undefined], context: [] } },
		],
		[
			"a context full of junk",
			file(null, 5, [], undefined, { variable: true }, { id: 1, name: 2 }, {}),
		],
	])("lists none, and does not throw, for %s", (_label, input) => {
		expect(() => patternVariables(input)).not.toThrow();
		expect(patternVariables(input)).toEqual([]);
	});

	it("lists only a name marked as a variable with the marker true", () => {
		const found = patternVariables(
			file(
				variable(SYSTEM, "system"),
				{ id: OWNER, name: "owner", text: "", variable: false },
				{ id: WINDOW, name: "window", text: "" },
				{ id: "aaaaaaaaaa", name: "text marker", text: "", variable: "true" },
				{ id: "bbbbbbbbbb", name: "number marker", text: "", variable: 1 },
				"A plain line"
			)
		);

		expect(found.map((item) => item.id)).toEqual([SYSTEM]);
	});

	it("leaves out an entry without an id, a name or a text", () => {
		const found = patternVariables(
			file(
				{ name: "no id", text: "", variable: true },
				{ id: OWNER, text: "", variable: true },
				{ id: WINDOW, name: "no text", variable: true }
			)
		);

		expect(found).toEqual([]);
	});

	it("takes a value only when it is text with something in it, trimmed", () => {
		const found = patternVariables(
			file(
				variable(SYSTEM, "padded", "", "  AcmeBot \n"),
				variable(OWNER, "blank", "", " \t "),
				variable(WINDOW, "empty", "", ""),
				{
					id: "aaaaaaaaaa",
					name: "number",
					text: "",
					value: 5,
					variable: true,
				},
				{
					id: "bbbbbbbbbb",
					name: "object",
					text: "",
					value: {},
					variable: true,
				}
			)
		);

		expect(found.map((item) => item.value)).toEqual([
			"AcmeBot",
			undefined,
			undefined,
			undefined,
			undefined,
		]);
		for (const item of found.slice(1)) {
			expect(item).not.toHaveProperty("value");
		}
	});

	it("lists the top element's variables first, then each element's before those of the elements beneath it", () => {
		const tree = {
			id: "g",
			name: "G1",
			children: [
				{
					id: "s1",
					name: "S1",
					context: [variable("s1aaaaaaaa", "s1")],
					children: [
						{
							id: "p1",
							name: "P1",
							context: [variable("p1aaaaaaaa", "p1")],
							children: [],
						},
					],
				},
				{ id: "s2", name: "S2", context: [variable("s2aaaaaaaa", "s2")] },
			],
			context: [variable("g1aaaaaaaa", "g1")],
		};

		expect(patternVariables({ tree }).map((item) => item.name)).toEqual([
			"g1",
			"s1",
			"p1",
			"s2",
		]);
	});

	it("lists a variable on an element marked as in the sandbox when the file holds that element in its tree", () => {
		const found = patternVariables({
			tree: {
				id: "g",
				name: "G1",
				children: [
					{
						id: "p1",
						name: "P1",
						inSandbox: true,
						context: [variable(SYSTEM, "flagged")],
						children: [],
					},
				],
			},
		});

		expect(found.map((item) => item.id)).toEqual([SYSTEM]);
	});

	it("writes a meaning with the variables in reach as they show, and any other name in braces", () => {
		const tree = {
			id: "g",
			name: "G1",
			context: [
				variable(
					SYSTEM,
					"system",
					`run by {owner#${OWNER}} for {gone#zzzzzzzzzz}`
				),
				variable(OWNER, "owner", "who answers", "Alice"),
			],
			children: [
				{
					id: "s",
					name: "S1",
					context: [
						variable(
							WINDOW,
							"window",
							`uses {system#${SYSTEM}} and {owner#${OWNER}}`
						),
					],
					children: [],
				},
			],
		};

		const found = patternVariables({ tree });

		expect(found[0]?.meaning).toBe("run by Alice for {gone}");
		expect(found[2]?.meaning).toBe("uses [system] and Alice");
	});

	it("shows a variable in reach with no value as its name in square brackets in a meaning", () => {
		const found = patternVariables(
			file(
				variable(SYSTEM, "system", `for {owner#${OWNER}}`),
				variable(OWNER, "owner", "who")
			)
		);

		expect(found[0]?.meaning).toBe("for [owner]");
	});

	it("reads a file a thousand levels deep", () => {
		let deepest: Record<string, unknown> = {
			id: "deep",
			name: "deep",
			context: [variable(SYSTEM, "found")],
			children: [],
		};
		for (let level = 0; level < 1000; level++) {
			deepest = { id: `n${level}`, name: `N${level}`, children: [deepest] };
		}

		expect(patternVariables({ tree: deepest }).map((item) => item.id)).toEqual([
			SYSTEM,
		]);
	});

	it("does not change the file it reads", () => {
		const input = deepFreeze(file(variable(SYSTEM, "system", "x", " v ")));

		expect(() => patternVariables(input)).not.toThrow();
	});
});

describe("setVariableValues", () => {
	const values = (entries: Record<string, string>) =>
		new Map(Object.entries(entries));

	const nested = () => ({
		version: "1.1",
		case: { name: "n", description: "d" },
		tree: {
			id: "g",
			name: "G1",
			description: `Goal {system#${SYSTEM}}`,
			context: [
				"A plain line",
				variable(SYSTEM, "system", "the system"),
				variable(OWNER, "owner", "who", "Default"),
				{ id: WINDOW, name: "window", text: "an interval", value: "5 minutes" },
			],
			children: [
				{
					id: "s",
					name: "S1",
					comments: [{ content: "kept" }],
					context: [variable("s1aaaaaaaa", "scope", "what")],
					children: [],
				},
			],
		},
	});

	it("does not change the file it is given", () => {
		const input = deepFreeze(nested());

		const output = setVariableValues(
			input,
			values({ [SYSTEM]: "AcmeBot", [OWNER]: "" })
		);

		expect(output).not.toBe(input);
		expect(input).toEqual(nested());
	});

	it("gives a variable its value, trimmed, wherever it sits in the tree", () => {
		const output = setVariableValues(
			nested(),
			values({ [SYSTEM]: "  AcmeBot  ", s1aaaaaaaa: "all\n" })
		) as ReturnType<typeof nested>;

		expect(output.tree.context[1]).toEqual({
			...variable(SYSTEM, "system", "the system"),
			value: "AcmeBot",
		});
		expect(output.tree.children[0]?.context[0]).toMatchObject({
			value: "all",
		});
	});

	it.each([
		["an empty value", ""],
		["a value of spaces", "   "],
		["a value of tabs and line breaks", "\t\n\r"],
	])("takes the value off a variable given %s, leaving no key", (_label, given) => {
		const output = setVariableValues(
			nested(),
			values({ [OWNER]: given })
		) as ReturnType<typeof nested>;

		const owner = output.tree.context[2] as Record<string, unknown>;
		expect(owner).toEqual(variable(OWNER, "owner", "who"));
		expect(owner).not.toHaveProperty("value");
	});

	it("leaves a variable that has no entry in the values as it is", () => {
		const output = setVariableValues(
			nested(),
			values({ [SYSTEM]: "AcmeBot" })
		) as ReturnType<typeof nested>;

		expect(output.tree.context[2]).toEqual(
			variable(OWNER, "owner", "who", "Default")
		);
	});

	it("never changes a name that is not a variable, though its id is given", () => {
		const output = setVariableValues(
			nested(),
			values({ [WINDOW]: "7 minutes" })
		) as ReturnType<typeof nested>;

		expect(output.tree.context[3]).toEqual({
			id: WINDOW,
			name: "window",
			text: "an interval",
			value: "5 minutes",
		});
	});

	it("never changes a name marked as a variable by something other than true", () => {
		const input = file(
			{ id: SYSTEM, name: "a", text: "", variable: "true" },
			{ id: OWNER, name: "b", text: "", variable: 1 },
			{ id: WINDOW, name: "c", text: "", variable: false, value: "kept" }
		);

		const output = setVariableValues(
			input,
			values({ [SYSTEM]: "x", [OWNER]: "y", [WINDOW]: "z" })
		);

		expect(output).toEqual(input);
	});

	it("leaves plain lines, descriptions, comments and every other key as they were", () => {
		const output = setVariableValues(
			nested(),
			values({ [SYSTEM]: "AcmeBot" })
		) as ReturnType<typeof nested>;

		expect(output.tree.context[0]).toBe("A plain line");
		expect(output.tree.description).toBe(`Goal {system#${SYSTEM}}`);
		expect(output.tree.children[0]?.comments).toEqual([{ content: "kept" }]);
		expect(output.case).toEqual({ name: "n", description: "d" });
		expect(output.version).toBe("1.1");
	});

	it("stores a value that looks like markup, a reference or a pattern exactly as given", () => {
		const given = [
			"<img src=x onerror=alert(1)>",
			`{window#${WINDOW}}`,
			"$& $1 $`",
			"__proto__",
			"{".repeat(100),
		];

		for (const value of given) {
			const output = setVariableValues(
				nested(),
				values({ [SYSTEM]: value })
			) as ReturnType<typeof nested>;
			expect((output.tree.context[1] as Record<string, unknown>).value).toBe(
				value
			);
		}
	});

	it("gives the value to every variable that has the id", () => {
		const input = {
			tree: {
				id: "g",
				name: "G1",
				context: [variable(SYSTEM, "one")],
				children: [{ id: "s", name: "S1", context: [variable(SYSTEM, "two")] }],
			},
		};

		const output = setVariableValues(input, values({ [SYSTEM]: "both" })) as {
			tree: {
				context: { value: string }[];
				children: { context: { value: string }[] }[];
			};
		};

		expect(output.tree.context[0]?.value).toBe("both");
		expect(output.tree.children[0]?.context[0]?.value).toBe("both");
	});

	it("changes nothing for no values, or for values that match nothing", () => {
		expect(setVariableValues(nested(), new Map())).toEqual(nested());
		expect(
			setVariableValues(nested(), values({ zzzzzzzzzz: "x", "": "y" }))
		).toEqual(nested());
	});

	it.each([
		["undefined", undefined],
		["null", null],
		["a number", 5],
		["text", "x"],
		["an array", [file(variable(SYSTEM, "system"))]],
	])("passes %s through untouched", (_label, input) => {
		expect(() =>
			setVariableValues(input, values({ [SYSTEM]: "x" }))
		).not.toThrow();
		expect(setVariableValues(input, values({ [SYSTEM]: "x" }))).toEqual(input);
	});

	it("passes through a file with a tree that is not an object, and elements that are not objects", () => {
		const input = {
			tree: {
				id: "g",
				name: "G1",
				context: "not a list",
				children: [
					null,
					5,
					"x",
					[],
					{ id: "s", context: [null, 5, [], variable(SYSTEM, "system")] },
				],
			},
		};

		const output = setVariableValues(
			input,
			values({ [SYSTEM]: "AcmeBot" })
		) as {
			tree: { children: { context?: unknown[] }[] };
		};

		expect(output.tree.children[4]?.context?.[3]).toMatchObject({
			value: "AcmeBot",
		});
		expect(output.tree.children.slice(0, 4)).toEqual([null, 5, "x", []]);
	});

	it("agrees with patternVariables: every id listed can be set, and the value then shows as the default", () => {
		const input = nested();
		const listed = patternVariables(input);

		const output = setVariableValues(
			input,
			new Map(listed.map((item) => [item.id, `value of ${item.name}`]))
		);

		expect(
			patternVariables(output).map((item) => [item.id, item.value])
		).toEqual(listed.map((item) => [item.id, `value of ${item.name}`]));
	});
});
