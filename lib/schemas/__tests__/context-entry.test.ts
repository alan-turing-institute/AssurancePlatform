import { describe, expect, it } from "vitest";
import { CaseExportNestedSchema } from "../case-export";
import {
	ContextEntriesSchema,
	findContextIdProblem,
	findContextListProblem,
	NamedContextEntrySchema,
} from "../context-entry";

const ID = "k3f9x2m7qa";

function firstMessage(input: unknown): string | undefined {
	const result = ContextEntriesSchema.safeParse([input]);
	return result.success ? undefined : result.error.issues[0]?.message;
}

describe("NamedContextEntrySchema", () => {
	it("accepts a name with an optional value and trims the name", () => {
		expect(
			NamedContextEntrySchema.parse({
				id: ID,
				name: "  response window  ",
				text: "the interval",
				value: "5 minutes",
			})
		).toEqual({
			id: ID,
			name: "response window",
			text: "the interval",
			value: "5 minutes",
		});
		expect(
			NamedContextEntrySchema.safeParse({ id: ID, name: "w", text: "" }).success
		).toBe(true);
	});

	it.each([
		["an empty name", { id: ID, name: "  ", text: "x" }],
		["a name over 40 characters", { id: ID, name: "a".repeat(41), text: "x" }],
		["a name that starts with a digit", { id: ID, name: "5min", text: "x" }],
		["a name with braces", { id: ID, name: "a{b}", text: "x" }],
		["a name with a hash", { id: ID, name: "a#b", text: "x" }],
		[
			"a value over 500 characters",
			{
				id: ID,
				name: "w",
				text: "x",
				value: "v".repeat(501),
			},
		],
		["an id of the wrong length", { id: "abc", name: "w", text: "x" }],
		["an id with capitals", { id: "K3F9X2M7QA", name: "w", text: "x" }],
	])("rejects %s", (_label, entry) => {
		expect(NamedContextEntrySchema.safeParse(entry).success).toBe(false);
	});
});

describe("ContextEntriesSchema messages", () => {
	it("names the missing key of a record instead of saying 'Invalid input'", () => {
		expect(firstMessage({ id: ID, text: "x" })).toBe(
			'A named context entry needs an id, a name and a text; missing "name"'
		);
	});

	it("names the unexpected key of a record", () => {
		expect(firstMessage({ id: ID, name: "w", text: "x", hidden: false })).toBe(
			'Unrecognized key: "hidden"'
		);
	});

	it("says what an entry may be when it is neither text nor a record", () => {
		expect(firstMessage(42)).toBe(
			"A context entry must be a piece of text or a named entry with an id, a name, a text and an optional value"
		);
	});

	it("says which rule a bad name broke", () => {
		expect(firstMessage({ id: ID, name: "5min", text: "x" })).toBe(
			"Context entry names must start with a letter and use only letters, digits, spaces, hyphens and underscores"
		);
	});
});

describe("findContextListProblem", () => {
	it("allows plain text and distinct names", () => {
		expect(
			findContextListProblem([
				"a",
				"a",
				{ id: ID, name: "window", text: "x" },
				{ id: "p4n8c2d6xz", name: "range", text: "y" },
			])
		).toBeUndefined();
	});

	it("rejects two names that differ only in case", () => {
		expect(
			findContextListProblem([
				{ id: ID, name: "Window", text: "x" },
				{ id: "p4n8c2d6xz", name: "window", text: "y" },
			])
		).toContain("Context entry names must be unique within an element");
	});

	it("rejects an id used twice on one element", () => {
		expect(
			findContextListProblem([
				{ id: ID, name: "a", text: "x" },
				{ id: ID, name: "b", text: "y" },
			])
		).toContain("Context entry id ");
	});
});

describe("findContextIdProblem", () => {
	it("rejects an id that appears on two elements", () => {
		expect(
			findContextIdProblem([
				[{ id: ID, name: "a", text: "x" }],
				["plain", { id: ID, name: "a", text: "x" }],
			])
		).toContain('Context entry id "k3f9x2m7qa" is used by more than one entry');
	});

	it("allows the same name with different ids on different elements", () => {
		expect(
			findContextIdProblem([
				[{ id: ID, name: "a", text: "x" }],
				[{ id: "p4n8c2d6xz", name: "a", text: "x" }],
			])
		).toBeUndefined();
	});
});

describe("a version 1.0 export file", () => {
	function file(version: string, context: unknown[]) {
		return {
			version,
			exportedAt: "2026-10-19T00:00:00.000Z",
			case: { name: "Case", description: "" },
			tree: {
				id: "00000000-0000-4000-8000-000000000001",
				type: "GOAL",
				name: "G1",
				description: "Goal",
				inSandbox: false,
				context,
				children: [],
			},
		};
	}
	const record = { id: ID, name: "window", text: "the interval" };

	it("is rejected when it holds a named entry, with a message that says why", () => {
		const result = CaseExportNestedSchema.safeParse(file("1.0", [record]));
		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toBe(
			'A version "1.0" file cannot hold named context entries; set the version to "1.1"'
		);
		expect(result.error?.issues[0]?.path).toEqual(["tree", "context", 0]);
	});

	it("is accepted when every entry is plain text", () => {
		expect(
			CaseExportNestedSchema.safeParse(file("1.0", ["plain"])).success
		).toBe(true);
	});

	it("is accepted as 1.1 when it holds a named entry", () => {
		expect(
			CaseExportNestedSchema.safeParse(file("1.1", [record, "plain"])).success
		).toBe(true);
	});
});
