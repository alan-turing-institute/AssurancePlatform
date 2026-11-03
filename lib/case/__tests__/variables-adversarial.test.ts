import { describe, expect, it } from "vitest";
import type { CaseExportNested, TreeNode } from "@/lib/schemas/case-export";
import { CaseExportNestedSchema } from "@/lib/schemas/case-export";
import type { ContextEntry } from "@/lib/schemas/context-entry";
import { NamedContextEntrySchema } from "@/lib/schemas/context-entry";
import {
	type DefinedTerm,
	parseContextEntries,
	plainContextEntry,
	plainReferenceText,
	termsInReach,
	toPlainCase,
} from "../defined-terms";
import {
	countUnsetVariables,
	countUnsetVariablesOnCards,
	fillInCountMessage,
	unsetVariableCountMessage,
} from "../placeholders";
import { computeTreeDiff, contextEqual } from "../tree-diff";

/**
 * Variables as every plain-text reader sees them: the value in place of the
 * name, "[name]" while there is no value, and the name only for a term that
 * is not a variable or is out of reach. The definitions are built here, so
 * these tests do not depend on how a variable gets written.
 */

const SYS = "aaaaaaaaaa";
const WIN = "bbbbbbbbbb";
const OTHER = "cccccccccc";
const MORE = "dddddddddd";

type Entry = Extract<ContextEntry, object>;

function variable(
	id: string,
	name: string,
	value?: string,
	text = "the system under test"
): Entry {
	return value === undefined
		? { id, name, text, variable: true }
		: { id, name, text, value, variable: true };
}

function ordinary(
	id: string,
	name: string,
	value?: string,
	text = "a meaning"
): Entry {
	return value === undefined ? { id, name, text } : { id, name, text, value };
}

function reach(...entries: Entry[]): DefinedTerm[] {
	return termsInReach([{ id: "g1", name: "G1", context: entries }]);
}

const ref = (name: string, id: string) => `{${name}#${id}}`;

/** Values that look like markup, a reference, a marker or a replacement pattern. */
const HOSTILE_VALUES: [string, string][] = [
	["markup", "<img src=x onerror=alert(1)>"],
	["script", "<script>window.__pwned = true</script>"],
	["Markdown emphasis", "**bold** _italic_ `code`"],
	["a Markdown link", "[click](https://example.test/x)"],
	["a Markdown heading", "# heading"],
	["a named reference", `{other#${OTHER}}`],
	["a bare brace word", "{other}"],
	["a closing brace", "}"],
	["an opening brace", "{"],
	["an equals sign", "="],
	["a marker lookalike", "{admin = yes}"],
	["a hash and an id", `#${OTHER}`],
	["a replacement pattern", "$& $1 $' $` $$"],
	["a backslash", "C:\\temp\\new"],
	["a newline", "line one\nline two"],
	["a carriage return", "line one\r\nline two"],
	["an unset marker word", "(not set)"],
	["a square-bracketed word", "[system]"],
	["a quoted value", `"quoted" 'single'`],
	["a percent and an ampersand", "100% & more"],
];

describe("a variable's reference as plain text", () => {
	const text = `The ${ref("system", SYS)} is safe`;

	it("shows the value in place of the name, with no braces", () => {
		const terms = reach(variable(SYS, "system", "AcmeBot"));
		expect(plainReferenceText(text, terms)).toBe("The AcmeBot is safe");
	});

	it("shows the name in square brackets while there is no value", () => {
		const terms = reach(variable(SYS, "system"));
		expect(plainReferenceText(text, terms)).toBe("The [system] is safe");
	});

	it.each([
		["spaces", "   "],
		["a tab", "\t"],
		["a newline", "\n"],
		["mixed whitespace", " \t\n "],
		["an empty string", ""],
	])("treats a value of %s as no value", (_what, value) => {
		const terms = reach(variable(SYS, "system", value));
		expect(plainReferenceText(text, terms)).toBe("The [system] is safe");
	});

	it("shows a value without the spaces round it", () => {
		const terms = reach(variable(SYS, "system", "  AcmeBot  "));
		expect(plainReferenceText(text, terms)).toBe("The AcmeBot is safe");
	});

	it("uses the variable's current name inside the brackets, not the one stored in the text", () => {
		const terms = reach(variable(SYS, "system"));
		expect(plainReferenceText(`A ${ref("old name", SYS)}`, terms)).toBe(
			"A [system]"
		);
	});

	it("leaves an ordinary term as {name}, whatever its value", () => {
		const terms = reach(ordinary(WIN, "window", "5 minutes"));
		expect(plainReferenceText(`In ${ref("window", WIN)}`, terms)).toBe(
			"In {window}"
		);
	});

	it("leaves an ordinary term as {name} even when it has no value and no meaning", () => {
		const terms = reach(ordinary(WIN, "window", undefined, ""));
		expect(plainReferenceText(`In ${ref("window", WIN)}`, terms)).toBe(
			"In {window}"
		);
	});

	it("keeps writing the stored name in braces for a variable that is out of reach", () => {
		expect(plainReferenceText(`A ${ref("system", SYS)}`, [])).toBe(
			"A {system}"
		);
		const unrelated = reach(variable(OTHER, "system", "AcmeBot"));
		expect(plainReferenceText(`A ${ref("system", SYS)}`, unrelated)).toBe(
			"A {system}"
		);
	});

	it("resolves by id, so a variable and an ordinary term that share a name do not mix", () => {
		const terms = reach(
			variable(SYS, "thing", "AcmeBot"),
			ordinary(WIN, "other thing", "5")
		);
		expect(
			plainReferenceText(`${ref("thing", WIN)} ${ref("x", SYS)}`, terms)
		).toBe("{other thing} AcmeBot");
	});

	it("shows every mention of the variable, however many", () => {
		const terms = reach(variable(SYS, "system", "AcmeBot"));
		expect(
			plainReferenceText(
				`${ref("system", SYS)}${ref("system", SYS)} and ${ref("system", SYS)}`,
				terms
			)
		).toBe("AcmeBotAcmeBot and AcmeBot");
	});

	it("returns text without a brace untouched", () => {
		const terms = reach(variable(SYS, "system", "AcmeBot"));
		expect(plainReferenceText("No references here", terms)).toBe(
			"No references here"
		);
	});

	it.each(
		HOSTILE_VALUES
	)("writes a value of %s exactly as it is, and reads nothing in it", (_what, value) => {
		const terms = reach(
			variable(SYS, "system", value),
			variable(OTHER, "other", "FILLED")
		);
		const shown = plainReferenceText(`<${ref("system", SYS)}>`, terms);
		expect(shown).toBe(`<${value.trim()}>`);
	});

	it("does not read a value that names another variable as a reference to it", () => {
		const terms = reach(
			variable(SYS, "system", `{other#${OTHER}}`),
			variable(OTHER, "other", "FILLED")
		);
		expect(plainReferenceText(ref("system", SYS), terms)).toBe(
			`{other#${OTHER}}`
		);
	});

	it("does not read a value that names an unset variable as a reference to it", () => {
		const terms = reach(
			variable(SYS, "system", `{other#${OTHER}}`),
			variable(OTHER, "other")
		);
		expect(plainReferenceText(ref("system", SYS), terms)).not.toContain(
			"[other]"
		);
	});

	it("does not loop on a value that refers to its own variable", () => {
		const terms = reach(variable(SYS, "system", ref("system", SYS)));
		expect(plainReferenceText(`A ${ref("system", SYS)}`, terms)).toBe(
			`A ${ref("system", SYS)}`
		);
	});

	it("does not loop on two variables whose values refer to each other", () => {
		const terms = reach(
			variable(SYS, "system", ref("other", OTHER)),
			variable(OTHER, "other", ref("system", SYS))
		);
		expect(plainReferenceText(ref("system", SYS), terms)).toBe(
			ref("other", OTHER)
		);
	});

	it("shows a value equal to another term's name as plain words, not as that term", () => {
		const terms = reach(
			variable(SYS, "system", "window"),
			ordinary(WIN, "window", "5 minutes")
		);
		expect(plainReferenceText(ref("system", SYS), terms)).toBe("window");
	});

	it("shows a value equal to its own name as that word, not as [name] or {name}", () => {
		const terms = reach(variable(SYS, "system", "system"));
		expect(plainReferenceText(ref("system", SYS), terms)).toBe("system");
	});

	it("writes the longest allowed value in full", () => {
		const value = "v".repeat(500);
		const terms = reach(variable(SYS, "system", value));
		expect(plainReferenceText(ref("system", SYS), terms)).toBe(value);
	});

	it("handles a very long text with many mentions quickly", () => {
		const terms = reach(variable(SYS, "system", "AcmeBot"));
		const long = `${ref("system", SYS)} word `.repeat(20_000);
		const started = Date.now();
		const shown = plainReferenceText(long, terms);
		expect(Date.now() - started).toBeLessThan(3000);
		expect(shown.startsWith("AcmeBot word AcmeBot word")).toBe(true);
		expect(shown).not.toContain("{");
	});
});

describe("a variable's reference in the marked form for a model", () => {
	const marked = { marked: true };
	const text = `The ${ref("system", SYS)} is safe`;

	it("writes the name and the value together", () => {
		const terms = reach(variable(SYS, "system", "AcmeBot"));
		expect(plainReferenceText(text, terms, marked)).toBe(
			'The {system = "AcmeBot"} is safe'
		);
	});

	it("says (not set) while there is no value, and never writes [name]", () => {
		const terms = reach(variable(SYS, "system"));
		const shown = plainReferenceText(text, terms, marked);
		expect(shown).toBe("The {system = (not set)} is safe");
		expect(shown).not.toContain("[");
	});

	it.each([
		["spaces", "   "],
		["a newline", "\n"],
		["an empty string", ""],
	])("says (not set) for a value of %s", (_what, value) => {
		const terms = reach(variable(SYS, "system", value));
		expect(plainReferenceText(text, terms, marked)).toBe(
			"The {system = (not set)} is safe"
		);
	});

	it("writes an ordinary term exactly as the unmarked form does", () => {
		const terms = reach(ordinary(WIN, "window", "5 minutes"));
		const input = `In ${ref("window", WIN)}`;
		expect(plainReferenceText(input, terms, marked)).toBe(
			plainReferenceText(input, terms)
		);
		expect(plainReferenceText(input, terms, marked)).toBe("In {window}");
	});

	it("writes a variable out of reach as {name}, with no marker of a value it does not have", () => {
		expect(plainReferenceText(`A ${ref("system", SYS)}`, [], marked)).toBe(
			"A {system}"
		);
	});

	it("writes the current name, not the stored one", () => {
		const terms = reach(variable(SYS, "system", "AcmeBot"));
		expect(
			plainReferenceText(`A ${ref("stale name", SYS)}`, terms, marked)
		).toBe('A {system = "AcmeBot"}');
	});

	it.each(
		HOSTILE_VALUES
	)("carries a value of %s through as it is, inside the marker", (_what, value) => {
		const terms = reach(variable(SYS, "system", value));
		const shown = plainReferenceText(ref("system", SYS), terms, marked);
		expect(shown).toBe(`{system = ${JSON.stringify(value.trim())}}`);
	});

	it("does not read a value that holds a reference as a reference", () => {
		const terms = reach(
			variable(SYS, "system", `{other#${OTHER}}`),
			variable(OTHER, "other", "FILLED")
		);
		expect(plainReferenceText(ref("system", SYS), terms, marked)).toBe(
			`{system = ${JSON.stringify(`{other#${OTHER}}`)}}`
		);
	});
});

describe("a definition line", () => {
	it("reads as before for an ordinary named entry", () => {
		expect(plainContextEntry(ordinary(WIN, "window", "5 minutes"))).toBe(
			"window: a meaning (value: 5 minutes)"
		);
		expect(plainContextEntry(ordinary(WIN, "window"))).toBe(
			"window: a meaning"
		);
		expect(plainContextEntry(ordinary(WIN, "window", undefined, ""))).toBe(
			"window"
		);
		expect(plainContextEntry(ordinary(WIN, "window", "  ", ""))).toBe("window");
	});

	it("says the value of a variable after its meaning", () => {
		expect(plainContextEntry(variable(SYS, "system", "AcmeBot"))).toBe(
			"system: the system under test (variable: AcmeBot)"
		);
	});

	it("says a variable is not set while it has no value", () => {
		expect(plainContextEntry(variable(SYS, "system"))).toBe(
			"system: the system under test (variable, not set)"
		);
		expect(plainContextEntry(variable(SYS, "system", "   "))).toBe(
			"system: the system under test (variable, not set)"
		);
		expect(plainContextEntry(variable(SYS, "system", undefined, ""))).toBe(
			"system (variable, not set)"
		);
	});

	it.each(
		HOSTILE_VALUES
	)("writes a value of %s as it is on a variable's line", (_what, value) => {
		expect(plainContextEntry(variable(SYS, "system", value))).toBe(
			`system: the system under test (variable: ${value.trim()})`
		);
	});

	it("writes a reference in a meaning with the same rule as any other text", () => {
		const terms = reach(variable(OTHER, "other", "FILLED"));
		const entry = {
			id: MORE,
			name: "extra",
			text: `uses ${ref("other", OTHER)}`,
		};
		expect(plainContextEntry(entry, terms)).toBe("extra: uses FILLED");
		expect(plainContextEntry(entry, terms, { marked: true })).toBe(
			'extra: uses {other = "FILLED"}'
		);
	});

	it("passes a plain text entry through the same rule for references", () => {
		const terms = reach(variable(OTHER, "other"));
		expect(plainContextEntry(`see ${ref("other", OTHER)}`, terms)).toBe(
			"see [other]"
		);
	});
});

/** A tree with a variable on the top goal and mentions at every depth and in every field. */
function tree(
	overrides: {
		sysValue?: string;
		sysFlag?: boolean;
		withPlaceholder?: { hint?: string | null; description?: string };
	} = {}
): TreeNode {
	const sys: Entry =
		overrides.sysFlag === false
			? ordinary(SYS, "system", overrides.sysValue)
			: variable(SYS, "system", overrides.sysValue);
	const node = (
		name: string,
		type: TreeNode["type"],
		fields: Partial<TreeNode> = {},
		children: TreeNode[] = []
	): TreeNode => ({
		id: `${name}-id`,
		type,
		name,
		description: `${name} text`,
		inSandbox: false,
		children,
		...fields,
	});
	return node(
		"G1",
		"GOAL",
		{
			role: "TOP_LEVEL",
			description: `The ${ref("system", SYS)} is safe; the ${ref("hidden", MORE)} too`,
			context: [sys, `scope: ${ref("system", SYS)}`],
		},
		[
			node(
				"S1",
				"STRATEGY",
				{
					description: `Argue over the ${ref("system", SYS)}`,
					assumption: `Assumes the ${ref("system", SYS)}`,
					justification: `Because the ${ref("system", SYS)}`,
					context: [
						ordinary(
							WIN,
							"window",
							"5 minutes",
							`a window for ${ref("system", SYS)}`
						),
						variable(MORE, "hidden", "SECRET"),
					],
				},
				[
					node(
						"P1",
						"PROPERTY_CLAIM",
						{
							description: `P1 about ${ref("system", SYS)} in ${ref("window", WIN)}`,
						},
						[
							node("E1", "EVIDENCE", {
								description: `Tested the ${ref("system", SYS)} for ${ref("window", WIN)}`,
								...(overrides.withPlaceholder
									? {
											isPlaceholder: true,
											placeholderHint: overrides.withPlaceholder.hint,
										}
									: {}),
							}),
						]
					),
				]
			),
			node("P2", "PROPERTY_CLAIM", {
				description: `Sibling mentions ${ref("system", SYS)} and ${ref("window", WIN)} and ${ref("hidden", MORE)}`,
			}),
		]
	);
}

function caseOf(root: TreeNode): CaseExportNested {
	return {
		version: "1.1",
		exportedAt: "2026-01-01T00:00:00.000Z",
		case: { name: "Case", description: "A case" },
		tree: root,
	} as CaseExportNested;
}

function find(root: TreeNode, name: string): TreeNode {
	const found = [root]
		.flatMap(function walk(n: TreeNode): TreeNode[] {
			return [n, ...n.children.flatMap(walk)];
		})
		.find((n) => n.name === name);
	if (!found) {
		throw new Error(`no element ${name}`);
	}
	return found;
}

function deepFreeze<T>(value: T): T {
	if (typeof value === "object" && value !== null) {
		for (const inner of Object.values(value)) {
			deepFreeze(inner);
		}
		Object.freeze(value);
	}
	return value;
}

describe("the plain-text copy of a case with a variable", () => {
	it("shows the value in every field of every element at or below the definition, evidence included", () => {
		const plain = toPlainCase(caseOf(tree({ sysValue: "AcmeBot" }))).tree;
		const p1 = find(plain as TreeNode, "P1");
		expect(plain.description).toBe("The AcmeBot is safe; the {hidden} too");
		expect(find(plain as TreeNode, "S1")).toMatchObject({
			description: "Argue over the AcmeBot",
			assumption: "Assumes the AcmeBot",
			justification: "Because the AcmeBot",
		});
		expect(p1.description).toBe("P1 about AcmeBot in {window}");
		expect(find(plain as TreeNode, "E1").description).toBe(
			"Tested the AcmeBot for {window}"
		);
	});

	it("shows [name] in the same places while the variable has no value", () => {
		const plain = toPlainCase(caseOf(tree())).tree as TreeNode;
		expect(plain.description).toBe("The [system] is safe; the {hidden} too");
		expect(find(plain, "P1").description).toBe("P1 about [system] in {window}");
		expect(find(plain, "E1").description).toBe(
			"Tested the [system] for {window}"
		);
	});

	it("does not show a variable's value to an element that cannot reach its definition", () => {
		const plain = toPlainCase(caseOf(tree({ sysValue: "AcmeBot" })))
			.tree as TreeNode;
		// "hidden" is defined on S1: the goal above it and the sibling beside it
		// cannot reach it, however many words they use.
		expect(plain.description).toContain("{hidden}");
		expect(find(plain, "P2").description).toBe(
			"Sibling mentions AcmeBot and {window} and {hidden}"
		);
		expect(JSON.stringify(plain)).not.toContain("[hidden]");
	});

	it("reaches the variable's value on the elements below the definition only", () => {
		const plain = toPlainCase(caseOf(tree({ sysValue: "AcmeBot" })))
			.tree as TreeNode;
		expect(find(plain, "E1").description).toBe(
			"Tested the AcmeBot for {window}"
		);
	});

	it("writes the definition lines of the context with the variable note, and other text with the value", () => {
		const unset = toPlainCase(caseOf(tree())).tree;
		expect(unset.context).toEqual([
			"system: the system under test (variable, not set)",
			"scope: [system]",
		]);
		const filled = toPlainCase(caseOf(tree({ sysValue: "AcmeBot" }))).tree;
		expect(filled.context).toEqual([
			"system: the system under test (variable: AcmeBot)",
			"scope: AcmeBot",
		]);
		const s1 = find(filled as TreeNode, "S1");
		expect(s1.context).toEqual([
			"window: a window for AcmeBot (value: 5 minutes)",
			"hidden: the system under test (variable: SECRET)",
		]);
	});

	it("leaves a case with an ordinary term in that place exactly as before", () => {
		const plain = toPlainCase(
			caseOf(tree({ sysFlag: false, sysValue: "AcmeBot" }))
		).tree as TreeNode;
		expect(plain.description).toBe("The {system} is safe; the {hidden} too");
		expect(plain.context).toEqual([
			"system: a meaning (value: AcmeBot)",
			"scope: {system}",
		]);
		expect(find(plain, "E1").description).toBe(
			"Tested the {system} for {window}"
		);
	});

	it("is the same marked or not when the case has no variable and no placeholder", () => {
		const input = caseOf(tree({ sysFlag: false, sysValue: "AcmeBot" }));
		// "hidden" is a variable defined on S1; make it an ordinary term too.
		const s1 = find(input.tree as TreeNode, "S1");
		s1.context = [
			ordinary(WIN, "window", "5 minutes"),
			ordinary(MORE, "hidden", "x"),
		];
		expect(toPlainCase(input, { marked: true })).toEqual(toPlainCase(input));
	});

	it("does not change the case it is given", () => {
		const input = deepFreeze(caseOf(tree({ sysValue: "AcmeBot" })));
		expect(() => toPlainCase(input)).not.toThrow();
		expect(() => toPlainCase(input, { marked: true })).not.toThrow();
		expect(find(input.tree as TreeNode, "P1").description).toContain(
			ref("system", SYS)
		);
	});

	it("writes each variable with its value in the marked form, and an unset one as (not set)", () => {
		const filled = toPlainCase(caseOf(tree({ sysValue: "AcmeBot" })), {
			marked: true,
		}).tree as TreeNode;
		expect(filled.description).toBe(
			'The {system = "AcmeBot"} is safe; the {hidden} too'
		);
		expect(find(filled, "E1").description).toBe(
			'Tested the {system = "AcmeBot"} for {window}'
		);
		expect(filled.context).toEqual([
			"system: the system under test (variable: AcmeBot)",
			'scope: {system = "AcmeBot"}',
		]);
		const unset = toPlainCase(caseOf(tree()), { marked: true })
			.tree as TreeNode;
		expect(unset.description).toBe(
			"The {system = (not set)} is safe; the {hidden} too"
		);
		expect(JSON.stringify(unset)).not.toContain("[system]");
	});

	it("never carries the id of a variable into either form", () => {
		for (const options of [undefined, { marked: true }]) {
			const text = JSON.stringify(
				toPlainCase(caseOf(tree({ sysValue: "AcmeBot" })), options)
			);
			expect(text).not.toContain(SYS);
			expect(text).not.toContain(MORE);
			expect(text).not.toContain("#");
		}
	});
});

describe("an element still to fill in in the marked form", () => {
	function marked(hint: string | null | undefined, description = "") {
		const plain = toPlainCase(
			caseOf(
				tree({
					sysValue: "AcmeBot",
					withPlaceholder: { hint },
				})
			),
			{ marked: true }
		).tree as TreeNode;
		const evidence = find(plain, "E1");
		evidence.description = evidence.description || description;
		return find(plain, "E1");
	}

	it("ends the description with the marker and the hint", () => {
		expect(marked("Name the test").description).toBe(
			'Tested the {system = "AcmeBot"} for {window} {to fill in: "Name the test"}'
		);
	});

	it.each([
		["no hint", undefined],
		["a null hint", null],
		["an empty hint", ""],
		["a hint of spaces", "   "],
	])("writes the marker alone for %s", (_what, hint) => {
		expect(marked(hint).description).toBe(
			'Tested the {system = "AcmeBot"} for {window} {to fill in}'
		);
	});

	it.each(
		HOSTILE_VALUES
	)("carries a hint of %s through as it is", (_what, hint) => {
		expect(marked(hint).description).toBe(
			`Tested the {system = "AcmeBot"} for {window} {to fill in: ${JSON.stringify(hint.trim())}}`
		);
	});

	it("writes nothing for the marker in the form a rules check reads", () => {
		const plain = toPlainCase(
			caseOf(
				tree({ sysValue: "AcmeBot", withPlaceholder: { hint: "Name it" } })
			)
		).tree as TreeNode;
		expect(find(plain, "E1").description).toBe(
			"Tested the AcmeBot for {window}"
		);
		expect(JSON.stringify(plain)).not.toContain("to fill in");
	});

	it("writes an empty placeholder as the marker alone, with no stray space", () => {
		const root = tree({ withPlaceholder: { hint: "Say it" } });
		const e1 = find(root, "E1");
		e1.description = "";
		const plain = toPlainCase(caseOf(root), { marked: true }).tree as TreeNode;
		expect(find(plain, "E1").description).toBe('{to fill in: "Say it"}');
	});

	it("does not mark an element that is not a placeholder", () => {
		const plain = toPlainCase(caseOf(tree({ sysValue: "x" })), {
			marked: true,
		}).tree as TreeNode;
		expect(JSON.stringify(plain)).not.toContain("to fill in");
	});
});

describe("what is written into a stored entry", () => {
	it.each([
		["false", false],
		["the string true", "true"],
		["the number one", 1],
		["null", null],
		["an object", {}],
	])("is not a variable when the stored flag is %s", (_what, flag) => {
		const [entry] = parseContextEntries([
			{ id: SYS, name: "system", text: "t", value: "v", variable: flag },
		]);
		expect(entry).toEqual({ id: SYS, name: "system", text: "t", value: "v" });
		const terms = termsInReach([
			{ id: "g1", name: "G1", context: parseContextEntries([entry]) },
		]);
		expect(plainReferenceText(ref("system", SYS), terms)).toBe("{system}");
	});

	it("keeps the flag only when it is exactly true, and drops other stray keys", () => {
		const [entry] = parseContextEntries([
			{ id: SYS, name: "system", text: "t", variable: true, extra: "x" },
		]);
		expect(entry).toEqual({
			id: SYS,
			name: "system",
			text: "t",
			variable: true,
		});
	});

	it("carries the flag onto the term in reach with its value", () => {
		const [term] = reach(variable(SYS, "system", "AcmeBot"));
		expect(term).toMatchObject({ id: SYS, variable: true, value: "AcmeBot" });
		const [plainTerm] = reach(ordinary(WIN, "window", "5"));
		expect(plainTerm?.variable).toBeUndefined();
	});
});

describe("the schema of a named entry", () => {
	const base = { id: SYS, name: "system", text: "the system" };

	it("accepts variable: true, with and without a value", () => {
		expect(
			NamedContextEntrySchema.safeParse({ ...base, variable: true })
		).toMatchObject({
			success: true,
		});
		const parsed = NamedContextEntrySchema.parse({
			...base,
			value: "AcmeBot",
			variable: true,
		});
		expect(parsed).toEqual({ ...base, value: "AcmeBot", variable: true });
	});

	it.each([
		["the string true", "true"],
		["the number one", 1],
		["null", null],
		["an array", [true]],
	])("refuses variable: %s", (_what, flag) => {
		expect(
			NamedContextEntrySchema.safeParse({ ...base, variable: flag }).success
		).toBe(false);
	});

	it("accepts variable: false and drops it, so the entry is the same as one without the flag", () => {
		const parsed = NamedContextEntrySchema.parse({ ...base, variable: false });
		expect(parsed).toEqual(base);
		expect(parsed).not.toHaveProperty("variable");
	});

	it("still refuses stray keys beside the flag", () => {
		expect(
			NamedContextEntrySchema.safeParse({
				...base,
				variable: true,
				isVariable: true,
			}).success
		).toBe(false);
	});

	it("applies the same limits to a variable's name and value as to any entry", () => {
		expect(
			NamedContextEntrySchema.safeParse({
				...base,
				value: "v".repeat(501),
				variable: true,
			}).success
		).toBe(false);
		expect(
			NamedContextEntrySchema.safeParse({
				...base,
				name: "{bad}",
				variable: true,
			}).success
		).toBe(false);
		expect(
			NamedContextEntrySchema.safeParse({
				...base,
				value: "v".repeat(500),
				variable: true,
			}).success
		).toBe(true);
	});
});

describe("the export document with a variable", () => {
	function document(version: "1.0" | "1.1", entry: unknown) {
		return {
			version,
			exportedAt: "2026-01-01T00:00:00.000Z",
			case: { name: "Case", description: "A case" },
			tree: {
				id: "11111111-1111-4111-8111-111111111111",
				type: "GOAL",
				name: "G1",
				description: "A goal",
				inSandbox: false,
				role: "TOP_LEVEL",
				context: [entry],
				children: [],
			},
		};
	}
	const entry = variable(SYS, "system", "AcmeBot");

	it("keeps a variable through parsing at version 1.1", () => {
		const parsed = CaseExportNestedSchema.safeParse(document("1.1", entry));
		expect(parsed.success).toBe(true);
		expect(parsed.success && parsed.data.tree.context).toEqual([entry]);
	});

	it("refuses a variable in a file that says version 1.0", () => {
		const parsed = CaseExportNestedSchema.safeParse(document("1.0", entry));
		expect(parsed.success).toBe(false);
	});

	it("refuses an unset variable in a file that says version 1.0", () => {
		expect(
			CaseExportNestedSchema.safeParse(document("1.0", variable(SYS, "system")))
				.success
		).toBe(false);
	});

	it("takes a hand-written variable: false at version 1.1 as no flag, and refuses it at 1.0 as the named entry it is", () => {
		const written = { ...ordinary(SYS, "system", "x"), variable: false };

		const current = CaseExportNestedSchema.safeParse(document("1.1", written));
		const older = CaseExportNestedSchema.safeParse(document("1.0", written));

		expect(current.success).toBe(true);
		expect(current.success && current.data.tree.context).toEqual([
			ordinary(SYS, "system", "x"),
		]);
		expect(older.success).toBe(false);
	});
});

describe("how many variables with no value a case mentions", () => {
	function chain(root: TreeNode) {
		return countUnsetVariables(root);
	}

	it("counts a variable once however often and wherever it is mentioned", () => {
		expect(chain(tree())).toBe(1);
	});

	it("counts nothing once the variable has a value", () => {
		expect(chain(tree({ sysValue: "AcmeBot" }))).toBe(0);
	});

	it.each([
		["spaces", "   "],
		["a newline", "\n"],
		["an empty string", ""],
	])("counts a variable whose value is %s", (_what, value) => {
		expect(chain(tree({ sysValue: value }))).toBe(1);
	});

	it("counts nothing for an ordinary term, with or without a value", () => {
		expect(chain(tree({ sysFlag: false }))).toBe(0);
		expect(chain(tree({ sysFlag: false, sysValue: "x" }))).toBe(0);
	});

	it("does not count a variable that is defined and never mentioned", () => {
		const root = tree();
		const strip = (n: TreeNode) => {
			n.description = n.description.replaceAll(ref("system", SYS), "it");
			if (typeof n.assumption === "string") {
				n.assumption = n.assumption.replaceAll(ref("system", SYS), "it");
			}
			if (typeof n.justification === "string") {
				n.justification = n.justification.replaceAll(ref("system", SYS), "it");
			}
			n.context = (n.context ?? []).map((entry) =>
				typeof entry === "string"
					? entry.replaceAll(ref("system", SYS), "it")
					: { ...entry, text: entry.text.replaceAll(ref("system", SYS), "it") }
			);
			for (const child of n.children) {
				strip(child);
			}
		};
		strip(root);
		expect(chain(root)).toBe(0);
	});

	it("does not count a variable mentioned only where its definition is out of reach", () => {
		const root = tree({ sysValue: "AcmeBot" });
		// "hidden" is an unset variable on S1, mentioned above it and beside it.
		const s1 = find(root, "S1");
		s1.context = [variable(MORE, "hidden")];
		const goal = root;
		goal.description = `Only ${ref("hidden", MORE)} here`;
		find(root, "P1").description = "nothing";
		find(root, "E1").description = "nothing";
		find(root, "P2").description = `Beside ${ref("hidden", MORE)}`;
		expect(chain(root)).toBe(0);
		// Mentioned at its own element and below, it counts.
		s1.description = `Own ${ref("hidden", MORE)}`;
		expect(chain(root)).toBe(1);
	});

	it("counts a mention in evidence, and in a plain context line, and in a meaning", () => {
		const base = (): TreeNode => {
			const root = tree();
			for (const name of ["G1", "S1", "P1", "P2", "E1"]) {
				const n = find(root, name);
				n.description = "plain";
				n.assumption = n.assumption ? "plain" : n.assumption;
				n.justification = n.justification ? "plain" : n.justification;
			}
			root.context = [variable(SYS, "system")];
			find(root, "S1").context = [];
			return root;
		};
		expect(chain(base())).toBe(0);

		const inEvidence = base();
		find(inEvidence, "E1").description = ref("system", SYS);
		expect(chain(inEvidence)).toBe(1);

		const inPlainLine = base();
		find(inPlainLine, "P1").context = [`see ${ref("system", SYS)}`];
		expect(chain(inPlainLine)).toBe(1);

		const inMeaning = base();
		find(inMeaning, "P1").context = [
			{ id: OTHER, name: "other", text: `uses ${ref("system", SYS)}` },
		];
		expect(chain(inMeaning)).toBe(1);

		const inJustification = base();
		find(inJustification, "P2").justification = ref("system", SYS);
		expect(chain(inJustification)).toBe(1);

		const inAssumption = base();
		find(inAssumption, "S1").assumption = ref("system", SYS);
		expect(chain(inAssumption)).toBe(1);
	});

	it("counts two different variables as two, even when they share a name", () => {
		const root = tree();
		find(root, "S1").context = [variable(OTHER, "system")];
		find(root, "S1").description = ref("system", OTHER);
		expect(chain(root)).toBe(2);
	});

	it("counts the same evidence once though it is listed under two claims", () => {
		const root = tree();
		const e1 = find(root, "E1");
		find(root, "P2").children.push(e1);
		expect(chain(root)).toBe(1);
	});

	it("does not count a variable mentioned by evidence whose parent cannot reach its definition", () => {
		const root = tree();
		find(root, "G1").context = [];
		find(root, "S1").context = [];
		find(root, "P1").context = [variable(SYS, "system")];
		find(root, "P1").description = "plain";
		find(root, "S1").description = "plain";
		find(root, "S1").assumption = "plain";
		find(root, "S1").justification = "plain";
		find(root, "G1").description = "plain";
		find(root, "P2").description = "plain";
		// E1 is under P1, which defines the variable: counted.
		find(root, "E1").description = ref("system", SYS);
		expect(chain(root)).toBe(1);
		// Under P2 it is out of reach.
		const e1 = find(root, "P1").children.pop();
		if (!e1) {
			throw new Error("no evidence");
		}
		find(root, "P2").children.push(e1);
		expect(chain(root)).toBe(0);
	});

	it("counts a reference whose stored name is stale the same as a current one", () => {
		const root = tree();
		find(root, "E1").description = ref("a stale name", SYS);
		expect(chain(root)).toBe(1);
	});
});

describe("how many variables with no value the open diagram mentions", () => {
	const unsetTerms = reach(variable(SYS, "system"));
	const setTerms = reach(variable(SYS, "system", "AcmeBot"));

	it("counts a variable once across cards, and not when the cards cannot reach it", () => {
		const cards = [
			{ description: `A ${ref("system", SYS)}`, termsInReach: unsetTerms },
			{ assumption: `B ${ref("system", SYS)}`, termsInReach: unsetTerms },
			{ description: `C ${ref("system", SYS)}`, termsInReach: [] },
		];
		expect(countUnsetVariablesOnCards(cards)).toBe(1);
	});

	it("counts nothing for a variable with a value, an ordinary term, or no terms", () => {
		expect(
			countUnsetVariablesOnCards([
				{ description: ref("system", SYS), termsInReach: setTerms },
				{
					description: ref("window", WIN),
					termsInReach: reach(ordinary(WIN, "window")),
				},
				{ description: ref("system", SYS) },
			])
		).toBe(0);
	});

	it("counts a mention in the card's context lines", () => {
		expect(
			countUnsetVariablesOnCards([
				{
					context: [`line ${ref("system", SYS)}`],
					termsInReach: unsetTerms,
				},
			])
		).toBe(1);
	});

	it("survives cards with odd or missing data", () => {
		expect(
			countUnsetVariablesOnCards([
				undefined,
				{},
				{ description: 5, termsInReach: "none", context: "x" },
				{ description: ref("system", SYS), termsInReach: null },
				{ context: [null, 4, { id: 1 }], termsInReach: unsetTerms },
			])
		).toBe(0);
	});

	it("takes any iterable of cards", () => {
		const set = new Set([
			{ description: ref("system", SYS), termsInReach: unsetTerms },
		]);
		expect(countUnsetVariablesOnCards(set)).toBe(1);
	});

	it("agrees with the count on the exported tree for the same case", () => {
		const root = tree();
		const cards: Array<{
			description: string;
			assumption?: string | null;
			justification?: string | null;
			context?: ContextEntry[];
			termsInReach: DefinedTerm[];
		}> = [];
		const visit = (
			n: TreeNode,
			chainOf: Array<{
				id: string;
				name: string | null;
				context?: ContextEntry[];
			}>
		) => {
			const own = [{ id: n.id, name: n.name, context: n.context }, ...chainOf];
			cards.push({
				description: n.description,
				assumption: n.assumption,
				justification: n.justification,
				context: n.context,
				termsInReach: termsInReach(own),
			});
			for (const child of n.children) {
				visit(child, own);
			}
		};
		visit(root, []);
		expect(countUnsetVariablesOnCards(cards)).toBe(countUnsetVariables(root));
		expect(countUnsetVariablesOnCards(cards)).toBe(1);
	});
});

describe("the words for what is left to fill in", () => {
	it("counts variables in the singular and the plural", () => {
		expect(unsetVariableCountMessage(1)).toBe("1 variable with no value");
		expect(unsetVariableCountMessage(2)).toBe("2 variables with no value");
		expect(unsetVariableCountMessage(11)).toBe("11 variables with no value");
	});

	it("says each count that is left and joins two with a semicolon", () => {
		expect(fillInCountMessage({ placeholders: 0, unsetVariables: 0 })).toBe("");
		expect(fillInCountMessage({ placeholders: 1, unsetVariables: 0 })).toBe(
			"1 element still to fill in"
		);
		expect(fillInCountMessage({ placeholders: 0, unsetVariables: 1 })).toBe(
			"1 variable with no value"
		);
		expect(fillInCountMessage({ placeholders: 2, unsetVariables: 3 })).toBe(
			"2 elements still to fill in; 3 variables with no value"
		);
		expect(fillInCountMessage({ placeholders: 1, unsetVariables: 1 })).toBe(
			"1 element still to fill in; 1 variable with no value"
		);
	});
});

describe("the difference the JSON editor sees", () => {
	function exportOf(entries: ContextEntry[]): CaseExportNested {
		return caseOf({
			id: "g1",
			type: "GOAL",
			name: "G1",
			description: "A goal",
			inSandbox: false,
			role: "TOP_LEVEL",
			context: entries,
			children: [],
		});
	}

	it("sees a name being marked as a variable, and being unmarked", () => {
		const plain = exportOf([
			ordinary(SYS, "system", "AcmeBot", "the system under test"),
		]);
		const marked = exportOf([variable(SYS, "system", "AcmeBot")]);
		const marking = computeTreeDiff(plain, marked);
		expect(marking.summary.updated).toBe(1);
		expect(marking.changes[0]).toMatchObject({
			type: "update",
			data: { context: [variable(SYS, "system", "AcmeBot")] },
		});
		const unmarking = computeTreeDiff(marked, plain);
		expect(unmarking.summary.updated).toBe(1);
		expect(unmarking.changes[0]).toMatchObject({
			type: "update",
			data: {
				context: [ordinary(SYS, "system", "AcmeBot", "the system under test")],
			},
		});
	});

	it("sees a new variable with no value, and a value being given to it", () => {
		const unset = exportOf([variable(SYS, "system")]);
		const set = exportOf([variable(SYS, "system", "AcmeBot")]);
		expect(computeTreeDiff(unset, set).summary.updated).toBe(1);
		expect(computeTreeDiff(set, unset).summary.updated).toBe(1);
	});

	it("sees nothing when the same variable is written with its keys in another order", () => {
		const a = exportOf([variable(SYS, "system", "AcmeBot")]);
		const b = exportOf([
			{
				variable: true,
				value: "AcmeBot",
				text: "the system under test",
				name: "system",
				id: SYS,
			},
		]);
		expect(computeTreeDiff(a, b).changes).toEqual([]);
		expect(
			contextEqual(
				[variable(SYS, "system", "AcmeBot")],
				[
					{
						variable: true,
						value: "AcmeBot",
						text: "the system under test",
						name: "system",
						id: SYS,
					},
				]
			)
		).toBe(true);
	});

	it("treats an absent flag and a flag on an otherwise equal entry as different", () => {
		expect(
			contextEqual(
				[ordinary(SYS, "system", "x", "the system under test")],
				[variable(SYS, "system", "x")]
			)
		).toBe(false);
		expect(
			contextEqual(
				[variable(SYS, "system", "x")],
				[ordinary(SYS, "system", "x", "the system under test")]
			)
		).toBe(false);
	});
});
