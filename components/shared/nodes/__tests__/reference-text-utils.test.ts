import { describe, expect, it } from "vitest";
import type { DefinedTerm } from "@/lib/case/defined-terms";
import { plainDescription, previewParts } from "../reference-text-utils";

const WINDOW: DefinedTerm = {
	id: "k3f9x2m7qa",
	name: "window",
	text: "the moving interval",
	definedOn: { elementId: "g1", elementName: "G1" },
};

describe("previewParts", () => {
	it("returns text that fits whole", () => {
		expect(previewParts("short", [], 180)).toEqual({
			parts: [{ type: "text", text: "short" }],
			truncated: false,
		});
	});

	it("cuts plain text at the limit and says so", () => {
		const { parts, truncated } = previewParts("abcdefghij", [], 4);
		expect(parts).toEqual([{ type: "text", text: "abcd" }]);
		expect(truncated).toBe(true);
	});

	it("finds a reference's term and shows its current name", () => {
		const { parts } = previewParts("a {old#k3f9x2m7qa} b", [WINDOW], 180);
		expect(parts[1]).toEqual({
			type: "reference",
			id: WINDOW.id,
			name: "window",
			term: WINDOW,
		});
	});

	it("shows the stored name when the term is out of reach", () => {
		const { parts } = previewParts("a {old#k3f9x2m7qa} b", [], 180);
		expect(parts[1]).toMatchObject({ name: "old", term: undefined });
	});

	it("counts a reference as the word shown, not the stored characters", () => {
		// "xx " is 3, "window" is 6 and " yy" is 3: 12 shown, 25 stored.
		expect(
			previewParts("xx {window#k3f9x2m7qa} yy", [WINDOW], 12).truncated
		).toBe(false);
	});

	it("never cuts through a reference: one that does not fit is left out whole", () => {
		const { parts, truncated } = previewParts(
			"xx {window#k3f9x2m7qa} yy",
			[WINDOW],
			5
		);
		expect(parts).toEqual([{ type: "text", text: "xx" }]);
		expect(truncated).toBe(true);
	});
});

describe("plainDescription", () => {
	it("writes each reference as {name} using the current name", () => {
		expect(
			plainDescription({
				description: "all {old#k3f9x2m7qa} are checked",
				termsInReach: [WINDOW],
			})
		).toBe("all {window} are checked");
	});

	it("falls back to the stored name with no terms, and to an empty string with no text", () => {
		expect(plainDescription({ description: "a {old#k3f9x2m7qa}" })).toBe(
			"a {old}"
		);
		expect(plainDescription(undefined)).toBe("");
	});
});
