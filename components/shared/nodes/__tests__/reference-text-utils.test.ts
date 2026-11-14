import { describe, expect, it } from "vitest";
import type { DefinedTerm } from "@/lib/case/defined-terms";
import {
	plainDescription,
	previewParts,
	searchableDescription,
} from "../reference-text-utils";

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

describe("a variable in previewParts", () => {
	const SYSTEM: DefinedTerm = {
		id: "k3f9x2m7qa",
		name: "system",
		text: "the system under test",
		variable: true,
		value: "AcmeBot",
		definedOn: { elementId: "g1", elementName: "G1" },
	};
	const TEXT = "on {sys#k3f9x2m7qa} today";

	it("shows its value as the word, counted as the characters people see", () => {
		const { parts, truncated } = previewParts(TEXT, [SYSTEM], 180);
		expect(parts[1]).toEqual({
			type: "reference",
			id: SYSTEM.id,
			name: "AcmeBot",
			term: SYSTEM,
		});
		expect(truncated).toBe(false);
		expect(previewParts(TEXT, [SYSTEM], 16).truncated).toBe(false);
		expect(previewParts(TEXT, [SYSTEM], 15).truncated).toBe(true);
	});

	it("shows [name] flagged unfilled when it has no value or only blanks", () => {
		for (const value of [undefined, "   "]) {
			const { parts } = previewParts(TEXT, [{ ...SYSTEM, value }], 180);
			expect(parts[1]).toMatchObject({ name: "[system]", unfilled: true });
		}
	});

	it("cuts a long value like ordinary text, but leaves out a [name] that does not fit whole", () => {
		const long = { ...SYSTEM, value: "AcmeBot version two" };
		const cut = previewParts(TEXT, [long], 10);
		expect(
			cut.parts.map((part) => (part.type === "text" ? part.text : part.name))
		).toEqual(["on ", "AcmeBot"]);
		expect(cut.truncated).toBe(true);

		const unset = previewParts(TEXT, [{ ...SYSTEM, value: undefined }], 6);
		expect(unset.parts).toEqual([{ type: "text", text: "on" }]);
		expect(unset.truncated).toBe(true);
	});

	it("shows an ordinary term exactly as before, with no unfilled flag", () => {
		const ordinary: DefinedTerm = { ...SYSTEM, variable: undefined };
		const { parts } = previewParts(TEXT, [ordinary], 180);
		expect(parts[1]).toEqual({
			type: "reference",
			id: SYSTEM.id,
			name: "system",
			term: ordinary,
		});
	});

	it("is written as its value, or [name], in the plain description", () => {
		expect(
			plainDescription({ description: TEXT, termsInReach: [SYSTEM] })
		).toBe("on AcmeBot today");
		expect(
			plainDescription({
				description: TEXT,
				termsInReach: [{ ...SYSTEM, value: undefined }],
			})
		).toBe("on [system] today");
	});

	it("is found by search under both its name and its value", () => {
		const data = { description: TEXT, termsInReach: [SYSTEM] };
		const searched = searchableDescription(data).toLowerCase();
		expect(searched).toContain("acmebot");
		expect(searched).toContain("system");
		expect(searchableDescription({ description: "plain" })).toBe("plain");
		expect(
			searchableDescription({
				description: "on {sys#k3f9x2m7qa}",
				termsInReach: [{ ...SYSTEM, variable: undefined }],
			})
		).toBe("on {system}");
	});
});
