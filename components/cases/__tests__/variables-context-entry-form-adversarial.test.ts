import { describe, expect, it } from "vitest";
import type { ContextEntry } from "@/lib/schemas/context-entry";
import {
	finaliseContextEntries,
	nameEntryAt,
	termsForEditedElement,
	unnameEntryAt,
} from "../context-entry-form";

/**
 * What the edit dialog sends back for a list of context entries that holds
 * variables: the flag and the value kept as written, nothing else added, and
 * a flag that is not exactly `true` never sent.
 */

const ID = "aaaaaaaaaa";
const OTHER = "bbbbbbbbbb";

describe("the list the dialog sends back", () => {
	it("keeps the variable flag and the value of a named entry", () => {
		expect(
			finaliseContextEntries([
				{
					id: ID,
					name: "system",
					text: "meaning",
					value: "AcmeBot",
					variable: true,
				},
			])
		).toEqual([
			{
				id: ID,
				name: "system",
				text: "meaning",
				value: "AcmeBot",
				variable: true,
			},
		]);
	});

	it("keeps a variable with no value, sending no value for it", () => {
		const [entry] = finaliseContextEntries([
			{ id: ID, name: "system", text: "meaning", variable: true },
		]) as Record<string, unknown>[];
		expect(entry).toEqual({
			id: ID,
			name: "system",
			text: "meaning",
			variable: true,
		});
		expect(entry).not.toHaveProperty("value");
	});

	it.each([
		["spaces", "   "],
		["a tab and newline", "\t\n"],
		["an empty string", ""],
	])("sends a variable whose value is %s as a variable with no value", (_what, value) => {
		const [entry] = finaliseContextEntries([
			{ id: ID, name: "system", text: "meaning", value, variable: true },
		]) as Record<string, unknown>[];
		expect(entry).toEqual({
			id: ID,
			name: "system",
			text: "meaning",
			variable: true,
		});
		expect(entry).not.toHaveProperty("value");
	});

	it("trims the value, name and meaning of a variable and keeps what is inside the value", () => {
		expect(
			finaliseContextEntries([
				{
					id: ID,
					name: "  system  ",
					text: "  meaning  ",
					value: "  a {b#cccccccccc}\n} = <i>x</i>  ",
					variable: true,
				},
			])
		).toEqual([
			{
				id: ID,
				name: "system",
				text: "meaning",
				value: "a {b#cccccccccc}\n} = <i>x</i>",
				variable: true,
			},
		]);
	});

	it("does not send a flag that is not exactly true", () => {
		for (const flag of [false, undefined, 0, "", null]) {
			const [entry] = finaliseContextEntries([
				{
					id: ID,
					name: "system",
					text: "m",
					variable: flag,
				} as unknown as ContextEntry,
			]) as Record<string, unknown>[];
			expect(entry).not.toHaveProperty("variable");
		}
	});

	it("sends no stray key with a variable", () => {
		const [entry] = finaliseContextEntries([
			{
				id: ID,
				name: "system",
				text: "m",
				variable: true,
				hidden: false,
				termsInReach: [],
			} as unknown as ContextEntry,
		]) as Record<string, unknown>[];
		expect(Object.keys(entry as object).sort()).toEqual([
			"id",
			"name",
			"text",
			"variable",
		]);
	});

	it("keeps a variable whose meaning is blank, and drops a blank plain line", () => {
		expect(
			finaliseContextEntries([
				"   ",
				{ id: ID, name: "system", text: "   ", variable: true },
			])
		).toEqual([{ id: ID, name: "system", text: "", variable: true }]);
	});

	it("sends an ordinary entry exactly as before, with no flag", () => {
		expect(
			finaliseContextEntries([
				{ id: ID, name: "window", text: "m", value: "5" },
			])
		).toEqual([{ id: ID, name: "window", text: "m", value: "5" }]);
	});
});

describe("naming and un-naming an entry that is or was a variable", () => {
	it("gives a newly named plain line no flag and no value", () => {
		const [entry] = nameEntryAt(["a plain line"], 0, new Set()) as Record<
			string,
			unknown
		>[];
		expect(entry).toMatchObject({ name: "", text: "a plain line" });
		expect(entry).not.toHaveProperty("variable");
		expect(entry).not.toHaveProperty("value");
	});

	it("turns a variable back into its meaning as plain text, with no trace of the flag or the value", () => {
		const [line] = unnameEntryAt(
			[
				{
					id: ID,
					name: "system",
					text: "the system",
					value: "AcmeBot",
					variable: true,
				},
			],
			0
		);
		expect(line).toBe("the system");
	});

	it("leaves the other entries of the list as they are", () => {
		const variable = {
			id: OTHER,
			name: "other",
			text: "m",
			value: "v",
			variable: true as const,
		};
		expect(
			unnameEntryAt(
				[
					{ id: ID, name: "system", text: "the system", variable: true },
					variable,
				],
				0
			)
		).toEqual(["the system", variable]);
	});
});

describe("the terms the dialog offers while entries are being edited", () => {
	it("offers a variable named in the form with its value, before it is saved", () => {
		const terms = termsForEditedElement({ id: "7", name: "P1" }, [
			{ id: ID, name: "system", text: "m", value: "AcmeBot", variable: true },
		]);
		expect(terms).toHaveLength(1);
		expect(terms[0]).toMatchObject({
			id: ID,
			name: "system",
			value: "AcmeBot",
			variable: true,
		});
	});

	it("does not offer a variable whose name is still empty", () => {
		expect(
			termsForEditedElement({ id: "7" }, [
				{ id: ID, name: "  ", text: "m", variable: true },
			])
		).toEqual([]);
	});

	it("uses the form's version of an entry over the stored card's, so un-marking is seen at once", () => {
		const stored = [
			{
				id: ID,
				name: "system",
				text: "m",
				value: "AcmeBot",
				variable: true as const,
				definedOn: { elementId: "7", elementName: "P1" },
			},
		];
		const terms = termsForEditedElement(
			{ id: "7", name: "P1", termsInReach: stored },
			[{ id: ID, name: "system", text: "m", value: "AcmeBot" }]
		);
		expect(terms).toHaveLength(1);
		expect(terms[0]?.variable).toBeUndefined();
	});

	it("keeps a variable defined above this element, as it came", () => {
		const above = {
			id: OTHER,
			name: "system",
			text: "m",
			value: "AcmeBot",
			variable: true as const,
			definedOn: { elementId: "1", elementName: "G1" },
		};
		const terms = termsForEditedElement(
			{ id: "7", name: "P1", termsInReach: [above] },
			[]
		);
		expect(terms).toEqual([above]);
	});
});
