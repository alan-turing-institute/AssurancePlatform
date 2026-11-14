import { afterEach, describe, expect, it, vi } from "vitest";
import { findDraftContextProblem } from "@/hooks/use-context-naming";
import { filterTerms } from "@/hooks/use-reference-suggestion";
import type { DefinedTerm } from "@/lib/case/defined-terms";
import {
	ContextEntriesSchema,
	type ContextEntry,
	NamedContextEntrySchema,
} from "@/lib/schemas/context-entry";
import {
	createContextEntryId,
	finaliseContextEntries,
	nameEntryAt,
	termsForEditedElement,
	unnameEntryAt,
} from "../context-entry-form";

const ID_PATTERN = /^[a-z0-9]{10}$/;
const ID_A = "aaaaaaaaaa";
const ID_B = "bbbbbbbbbb";

function term(id: string, name: string, elementId = "g1"): DefinedTerm {
	return {
		id,
		name,
		text: `${name} meaning`,
		definedOn: { elementId, elementName: elementId.toUpperCase() },
	};
}

describe("a new entry id", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("is always ten lowercase letters or digits and never one already taken", () => {
		const taken = new Set<string>();
		for (let i = 0; i < 500; i++) {
			const id = createContextEntryId(taken);
			expect(id).toMatch(ID_PATTERN);
			expect(taken.has(id)).toBe(false);
			taken.add(id);
		}
		expect(taken.size).toBe(500);
		expect(
			NamedContextEntrySchema.safeParse({
				id: [...taken][0],
				name: "x",
				text: "t",
			}).success
		).toBe(true);
	});

	it("is made without crypto.randomUUID, which is missing over plain http", () => {
		const source = globalThis.crypto;
		vi.stubGlobal("crypto", {
			getRandomValues: source.getRandomValues.bind(source),
		});
		expect(createContextEntryId(new Set())).toMatch(ID_PATTERN);
	});

	it("redraws when the first draw is taken", () => {
		const first = createContextEntryId(new Set());
		const taken = new Set([first]);
		const spy = vi
			.spyOn(globalThis.crypto, "getRandomValues")
			.mockImplementationOnce((array) => {
				const bytes = array as Uint8Array;
				bytes.fill(0);
				return array;
			});
		// An all-zero draw is the id "aaaaaaaaaa"; mark it taken and the next draw must differ.
		taken.add(ID_A);
		const id = createContextEntryId(taken);
		spy.mockRestore();
		expect(taken.has(id)).toBe(false);
	});
});

describe("what the edit dialog sends back for the context list", () => {
	it("rebuilds a named entry from its four fields, trims it, and drops a blank value", () => {
		const entries = [
			{
				id: ID_A,
				name: "  window ",
				text: "  an interval  ",
				value: "   ",
				hidden: false,
				extra: 1,
			},
			{ id: ID_B, name: "n", text: "t", value: " 5 minutes " },
		] as unknown as ContextEntry[];
		expect(finaliseContextEntries(entries)).toEqual([
			{ id: ID_A, name: "window", text: "an interval" },
			{ id: ID_B, name: "n", text: "t", value: "5 minutes" },
		]);
		expect(
			Object.keys(finaliseContextEntries(entries)[0] as object).sort()
		).toEqual(["id", "name", "text"]);
	});

	it("drops blank plain entries, keeps order, and keeps a named entry whose text is blank", () => {
		const finished = finaliseContextEntries([
			"  one ",
			"   ",
			"",
			{ id: ID_A, name: "w", text: "   " },
			"two",
		]);
		expect(finished).toEqual(["one", { id: ID_A, name: "w", text: "" }, "two"]);
		expect(ContextEntriesSchema.safeParse(finished).success).toBe(true);
	});

	it("treats an empty slot in the list as blank text", () => {
		const slot = undefined as unknown as ContextEntry;
		expect(finaliseContextEntries([slot, "kept"])).toEqual(["kept"]);
	});
});

describe("naming and un-naming an entry", () => {
	it("names only a plain entry, keeps its text, and leaves the others as they are", () => {
		const named = { id: ID_A, name: "w", text: "t" };
		const result = nameEntryAt(["one", "two", named], 1, new Set([ID_A]));
		expect(result[0]).toBe("one");
		expect(result[2]).toBe(named);
		const second = result[1] as { id: string; name: string; text: string };
		expect(second).toMatchObject({ name: "", text: "two" });
		expect(second.id).toMatch(ID_PATTERN);
		expect(second.id).not.toBe(ID_A);
		// Naming an entry that is already named changes nothing.
		expect(nameEntryAt([named], 0, new Set())[0]).toBe(named);
		// An index past the end changes nothing.
		expect(nameEntryAt(["one"], 5, new Set())).toEqual(["one"]);
	});

	it("turns a named entry back into its text alone, dropping the name and value", () => {
		expect(
			unnameEntryAt(
				["one", { id: ID_A, name: "w", text: "meaning", value: "5" }],
				1
			)
		).toEqual(["one", "meaning"]);
		expect(unnameEntryAt(["one"], 0)).toEqual(["one"]);
	});
});

describe("the terms the description editor offers while entries are being edited", () => {
	const inherited = [
		term(ID_A, "inherited", "g1"),
		term(ID_B, "own old", "p1"),
	];

	it("lists the form's own named entries first, then those above, leaving out the element's stored copies", () => {
		const terms = termsForEditedElement(
			{ id: "p1", name: "P1", termsInReach: inherited },
			[{ id: "cccccccccc", name: "fresh", text: "just named" }]
		);
		expect(terms.map((candidate) => candidate.name)).toEqual([
			"fresh",
			"inherited",
		]);
		expect(terms[0]?.definedOn).toEqual({ elementId: "p1", elementName: "P1" });
	});

	it("leaves out a name still being typed, and copes with an element without terms", () => {
		expect(
			termsForEditedElement({ id: "p1" }, [
				{ id: ID_A, name: "", text: "t" },
				{ id: ID_B, name: "   ", text: "t" },
				"plain",
			])
		).toEqual([]);
	});
});

describe("the draft list's own check", () => {
	it("ignores entries with no name yet, and flags the same name in different case", () => {
		expect(
			findDraftContextProblem([
				{ id: ID_A, name: "", text: "t" },
				{ id: ID_B, name: "", text: "u" },
				"plain",
			])
		).toBeUndefined();
		expect(
			findDraftContextProblem([
				{ id: ID_A, name: "Window", text: "t" },
				{ id: ID_B, name: " window", text: "u" },
			])
		).toBeDefined();
	});
});

describe("filtering the pick-list as the author types", () => {
	const terms = [term(ID_A, "Time window"), term(ID_B, "Sample (n)")];

	it("matches part of a name in any case, keeping the nearest first", () => {
		expect(filterTerms(terms, "WIND").map((t) => t.name)).toEqual([
			"Time window",
		]);
		expect(filterTerms(terms, "  ").map((t) => t.name)).toEqual([
			"Time window",
			"Sample (n)",
		]);
	});

	it("takes what is typed literally, not as a pattern", () => {
		expect(filterTerms(terms, ".*")).toEqual([]);
		expect(filterTerms(terms, "(n)").map((t) => t.name)).toEqual([
			"Sample (n)",
		]);
		expect(filterTerms(terms, "[")).toEqual([]);
	});
});
