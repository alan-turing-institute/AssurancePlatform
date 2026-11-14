import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CaseExportNestedSchema } from "../case-export";
import {
	ContextEntrySchema,
	findContextIdProblem,
	findContextListProblem,
	NamedContextEntrySchema,
} from "../context-entry";
import { detectAndValidate } from "../version-detection";

const ID_A = "aaaaaaaaaa";
const ID_B = "bbbbbbbbbb";

function entry(overrides: Record<string, unknown> = {}) {
	return { id: ID_A, name: "window", text: "an interval", ...overrides };
}

describe("a named context entry's name", () => {
	it.each([
		["a letter and nothing else", "w"],
		["letters, digits, spaces, hyphens and underscores", "Time window-2_a b"],
		["exactly 40 characters", `a${"b".repeat(39)}`],
		["non-English letters", "Zeitfenster Überprüfung"],
		["surrounding space, which is trimmed", "  window  "],
	])("accepts %s", (_label, name) => {
		const parsed = NamedContextEntrySchema.safeParse(entry({ name }));
		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data.name).toBe(name.trim());
		}
	});

	it.each([
		["empty", ""],
		["only spaces", "   "],
		["41 characters", `a${"b".repeat(40)}`],
		["starting with a digit", "1window"],
		["starting with a hyphen", "-window"],
		["starting with an underscore", "_window"],
		["containing a dot", "win.dow"],
		["containing a brace", "win{dow"],
		["containing a hash", "win#dow"],
		["containing a newline", "win\ndow"],
		["containing a tab", "win\tdow"],
		["containing markup", "<b>window</b>"],
		["containing a script", "window<script>alert(1)</script>"],
		["an emoji", "window 🙂"],
	])("rejects a name that is %s", (_label, name) => {
		expect(NamedContextEntrySchema.safeParse(entry({ name })).success).toBe(
			false
		);
	});

	it("treats a name the same whether its accents are precomposed or typed as separate combining marks", () => {
		const precomposed = "Fen\u00eatre";
		const decomposed = "Fene\u0302tre";
		expect(precomposed.normalize("NFD")).toBe(decomposed);
		const verdicts = [precomposed, decomposed].map(
			(name) => NamedContextEntrySchema.safeParse(entry({ name })).success
		);
		expect(verdicts).toEqual([true, true]);
	});

	it("counts a name's length after trimming", () => {
		const padded = `  ${"a".repeat(40)}  `;
		expect(
			NamedContextEntrySchema.safeParse(entry({ name: padded })).success
		).toBe(true);
	});
});

describe("a named context entry's value", () => {
	it("allows 500 characters and refuses 501", () => {
		expect(
			NamedContextEntrySchema.safeParse(entry({ value: "v".repeat(500) }))
				.success
		).toBe(true);
		expect(
			NamedContextEntrySchema.safeParse(entry({ value: "v".repeat(501) }))
				.success
		).toBe(false);
	});

	it("keeps markup in a value as the characters it is", () => {
		const value = "<img src=x onerror=alert(1)>";
		const parsed = NamedContextEntrySchema.parse(entry({ value }));
		expect(parsed.value).toBe(value);
	});
});

describe("a named context entry's id", () => {
	it.each([
		["9 characters", "abcdefghi"],
		["11 characters", "abcdefghijk"],
		["with a capital", "Abcdefghij"],
		["with a hyphen", "abcdefghi-"],
		["with a space", "abcdefghi "],
		["empty", ""],
		["a number", 1_234_567_890],
		["null", null],
	])("rejects an id that is %s", (_label, id) => {
		expect(NamedContextEntrySchema.safeParse(entry({ id })).success).toBe(
			false
		);
	});

	it("accepts ten lowercase letters or digits", () => {
		expect(
			NamedContextEntrySchema.safeParse(entry({ id: "a1b2c3d4e5" })).success
		).toBe(true);
	});

	it("refuses a key the entry does not define, such as a visibility flag", () => {
		expect(
			NamedContextEntrySchema.safeParse(entry({ hidden: false })).success
		).toBe(false);
	});
});

describe("the string-or-record choice", () => {
	it("says which key is missing, not a bare 'Invalid input'", () => {
		const parsed = ContextEntrySchema.safeParse({ id: ID_A });
		expect(parsed.success).toBe(false);
		const message = parsed.error?.issues.map((issue) => issue.message).join();
		expect(message).toContain("name");
		expect(message).toContain("text");
		expect(message).not.toBe("Invalid input");
	});

	it("gives a readable message for something that is neither text nor a record", () => {
		for (const input of [7, null, ["x"], true]) {
			const parsed = ContextEntrySchema.safeParse(input);
			expect(parsed.success).toBe(false);
			expect(parsed.error?.issues[0]?.message).not.toBe("Invalid input");
		}
	});
});

describe("the message for a malformed named entry", () => {
	function messagesFor(input: unknown): string | undefined {
		const parsed = ContextEntrySchema.safeParse(input);
		return parsed.success
			? undefined
			: parsed.error.issues
					.map((issue) => issue.message)
					.join(" | ")
					.toLowerCase();
	}

	it.each([
		[
			"a name that starts with a digit",
			entry({ name: "1window" }),
			"start with a letter",
		],
		["an empty name", entry({ name: "" }), "must not be empty"],
		[
			"a name of 41 characters",
			entry({ name: "a".repeat(41) }),
			"at most 40 characters",
		],
		[
			"a value of 501 characters",
			entry({ value: "v".repeat(501) }),
			"at most 500 characters",
		],
		[
			"an id of the wrong form",
			entry({ id: "ABC" }),
			"10 lowercase letters or digits",
		],
		["an unexpected key", entry({ hidden: false }), "hidden"],
	])("says which rule is broken by %s", (_label, input, phrase) => {
		expect(messagesFor(input)).toContain(phrase.toLowerCase());
	});
});

describe("rules across one element's list", () => {
	it("refuses the same name twice, ignoring case and surrounding space", () => {
		const problem = findContextListProblem([
			entry({ name: "Window" }),
			entry({ id: ID_B, name: " window " }),
		]);
		expect(problem?.toLowerCase()).toContain("unique");
	});

	it("allows different names, and plain text beside a named entry", () => {
		expect(
			findContextListProblem([
				entry(),
				entry({ id: ID_B, name: "other" }),
				"window",
			])
		).toBeUndefined();
	});

	it("refuses one id used by two entries on the same element", () => {
		expect(
			findContextListProblem([entry(), entry({ name: "other" })])
		).toBeDefined();
	});

	it("refuses an id repeated across the lists of a case, and allows one use of each", () => {
		expect(
			findContextIdProblem([[entry()], ["text"], [entry({ name: "again" })]])
		).toBeDefined();
		expect(
			findContextIdProblem([[entry()], [entry({ id: ID_B })]])
		).toBeUndefined();
	});
});

describe("version 1.0 and 1.1 of the nested export", () => {
	function file(version: string, context: unknown[], depth = 0) {
		let inner: Record<string, unknown> = {
			id: randomUUID(),
			type: "PROPERTY_CLAIM",
			name: "P1",
			description: `Uses {window#${ID_A}}`,
			inSandbox: false,
			context,
			children: [],
		};
		for (let level = 0; level < depth; level++) {
			inner = {
				id: randomUUID(),
				type: "STRATEGY",
				name: `S${level + 1}`,
				description: "Strategy",
				inSandbox: false,
				children: [inner],
			};
		}
		return {
			version,
			exportedAt: "2026-01-01T00:00:00.000Z",
			case: { name: "Case", description: "A case" },
			tree: {
				id: randomUUID(),
				type: "GOAL",
				name: "G1",
				description: "Goal",
				inSandbox: false,
				role: "TOP_LEVEL",
				children: [inner],
			},
		};
	}

	it("accepts a 1.1 file with a named entry", () => {
		expect(
			CaseExportNestedSchema.safeParse(file("1.1", [entry()])).success
		).toBe(true);
	});

	it("accepts a 1.0 file of plain text, even when a text holds a reference-shaped token", () => {
		expect(
			CaseExportNestedSchema.safeParse(file("1.0", ["plain"])).success
		).toBe(true);
	});

	it.each([
		0, 1, 4,
	])("rejects a 1.0 file holding a named entry %i levels down, with a message that points at the version", (depth) => {
		const verdict = detectAndValidate(file("1.0", [entry()], depth));
		expect(verdict.isValid).toBe(false);
		if (verdict.isValid === false) {
			const messages = verdict.errors.map((error) => error.message).join("\n");
			expect(messages).toContain("1.0");
			expect(messages).toContain("1.1");
			const paths = verdict.errors.map((error) => error.path).join("\n");
			expect(paths).toContain("context");
		}
	});

	it("still rejects an unknown version", () => {
		expect(
			CaseExportNestedSchema.safeParse(file("1.2", ["plain"])).success
		).toBe(false);
		expect(
			CaseExportNestedSchema.safeParse(file("2.0", ["plain"])).success
		).toBe(false);
	});

	it("rejects a malformed record in a 1.1 file with a message that names what is wrong", () => {
		const verdict = detectAndValidate(
			file("1.1", [{ id: ID_A, name: "window" }])
		);
		expect(verdict.isValid).toBe(false);
		if (verdict.isValid === false) {
			const messages = verdict.errors.map((error) => error.message).join("\n");
			expect(messages).toContain("text");
			expect(messages).not.toBe("Invalid input");
		}
	});
});
