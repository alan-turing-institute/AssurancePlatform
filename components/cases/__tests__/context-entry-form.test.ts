import { describe, expect, it } from "vitest";
import type { DefinedTerm } from "@/lib/case/defined-terms";
import {
	createContextEntryId,
	finaliseContextEntries,
	isNamedEntryValue,
	namedEntryIds,
	nameEntryAt,
	termsForEditedElement,
	unnameEntryAt,
} from "../context-entry-form";

const ENTRY_ID_PATTERN = /^[a-z0-9]{10}$/;

const WINDOW = {
	id: "k3f9x2m7qa",
	name: "window",
	text: "the moving interval",
	value: "5 minutes",
};

describe("createContextEntryId", () => {
	it("makes ten lowercase letters or digits", () => {
		for (let attempt = 0; attempt < 50; attempt++) {
			expect(createContextEntryId(new Set())).toMatch(ENTRY_ID_PATTERN);
		}
	});

	it("never repeats an id that is already taken", () => {
		const taken = new Set<string>();
		for (let attempt = 0; attempt < 200; attempt++) {
			const id = createContextEntryId(taken);
			expect(taken.has(id)).toBe(false);
			taken.add(id);
		}
	});
});

describe("naming and un-naming an entry", () => {
	it("turns the chosen plain entry into a named entry with no name yet", () => {
		const [first, second] = nameEntryAt(["a", "b"], 1, new Set());
		expect(first).toBe("a");
		expect(second).toMatchObject({ name: "", text: "b" });
		expect(isNamedEntryValue(second)).toBe(true);
	});

	it("leaves a named entry as it is when asked to name it again", () => {
		expect(nameEntryAt([WINDOW], 0, new Set())).toEqual([WINDOW]);
	});

	it("turns a named entry back into its text, dropping the name and value", () => {
		expect(unnameEntryAt(["a", WINDOW], 1)).toEqual(["a", WINDOW.text]);
	});

	it("lists the ids of the named entries only", () => {
		expect(namedEntryIds(["a", WINDOW])).toEqual(new Set([WINDOW.id]));
	});
});

describe("finaliseContextEntries", () => {
	it("trims text, leaves out blank text and keeps the order", () => {
		expect(finaliseContextEntries(["  a ", "   ", "b"])).toEqual(["a", "b"]);
	});

	it("rebuilds a named entry from its four fields and leaves out an empty value", () => {
		const stray = { ...WINDOW, name: " window ", value: "  ", hidden: true };
		expect(finaliseContextEntries([stray])).toEqual([
			{ id: WINDOW.id, name: "window", text: WINDOW.text },
		]);
	});

	it("drops an empty slot the form can briefly hold", () => {
		expect(
			finaliseContextEntries([undefined as unknown as string, "a"])
		).toEqual(["a"]);
	});
});

describe("termsForEditedElement", () => {
	const aboveTerm: DefinedTerm = {
		id: "a1b2c3d4e5",
		name: "rate",
		text: "events per second",
		definedOn: { elementId: "g1", elementName: "G1" },
	};
	const staleOwn: DefinedTerm = {
		id: WINDOW.id,
		name: "old name",
		text: "saved earlier",
		definedOn: { elementId: "s2", elementName: "S2" },
	};

	it("lists the entries as they stand in the form before those above", () => {
		const terms = termsForEditedElement(
			{ id: "s2", name: "S2", termsInReach: [staleOwn, aboveTerm] },
			[WINDOW]
		);
		expect(terms.map((term) => term.name)).toEqual(["window", "rate"]);
		expect(terms[0]?.definedOn).toEqual({
			elementId: "s2",
			elementName: "S2",
		});
	});

	it("leaves out a name still being typed", () => {
		const terms = termsForEditedElement({ id: "s2", name: "S2" }, [
			{ ...WINDOW, name: "" },
		]);
		expect(terms).toEqual([]);
	});

	it("has only its own entries when the card has no terms above", () => {
		expect(
			termsForEditedElement({ id: "s2" }, [WINDOW, "plain"]).map(
				(term) => term.id
			)
		).toEqual([WINDOW.id]);
	});
});
