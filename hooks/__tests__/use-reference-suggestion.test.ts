import { describe, expect, it } from "vitest";
import type { DefinedTerm } from "@/lib/case/defined-terms";
import {
	filterTerms,
	isListVisible,
	type ReferenceListState,
} from "../use-reference-suggestion";

function term(name: string, elementName: string): DefinedTerm {
	return {
		id: `${name}-id`,
		name,
		text: `meaning of ${name}`,
		definedOn: { elementId: elementName, elementName },
	};
}

const WINDOW = term("window", "S2");
const OUTER_WINDOW = term("Window", "G1");
const RATE = term("rate", "G1");

function listOf(items: DefinedTerm[], query: string): ReferenceListState {
	return { items, position: null, query, select: () => undefined };
}

describe("filterTerms", () => {
	it("returns every term, in the order given, when nothing has been typed", () => {
		expect(filterTerms([WINDOW, RATE], "")).toEqual([WINDOW, RATE]);
		expect(filterTerms([WINDOW, RATE], "   ")).toEqual([WINDOW, RATE]);
	});

	it("keeps the terms whose name contains what was typed, ignoring case", () => {
		expect(filterTerms([WINDOW, RATE], "WIN")).toEqual([WINDOW]);
		expect(filterTerms([WINDOW, RATE], "at")).toEqual([RATE]);
	});

	it("lists two terms with the same name, nearer first", () => {
		expect(filterTerms([WINDOW, OUTER_WINDOW, RATE], "window")).toEqual([
			WINDOW,
			OUTER_WINDOW,
		]);
	});

	it("matches a name with a space in it as the space is typed", () => {
		const sized = term("window size", "G1");
		expect(filterTerms([WINDOW, sized], "window s")).toEqual([sized]);
	});

	it("returns nothing when no name matches", () => {
		expect(filterTerms([WINDOW, RATE], "zzz")).toEqual([]);
	});
});

describe("isListVisible", () => {
	it("is hidden when no suggestion is active", () => {
		expect(isListVisible(null, 3)).toBe(false);
	});

	it("is shown when there are terms to pick", () => {
		expect(isListVisible(listOf([WINDOW], "w"), 3)).toBe(true);
	});

	it("is hidden when what was typed matches nothing, so Escape then closes the dialog", () => {
		expect(isListVisible(listOf([], "zzz"), 3)).toBe(false);
	});

	it("is shown with a hint when there are no terms at all", () => {
		expect(isListVisible(listOf([], ""), 0)).toBe(true);
		expect(isListVisible(listOf([], "x"), 0)).toBe(false);
	});
});
