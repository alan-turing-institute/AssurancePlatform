import { describe, expect, it } from "vitest";
import {
	publishableItemSlugSchema,
	publishableItemTypeSchema,
	publishedSnapshotMetaSchema,
} from "../publishable-item";

const messageOf = (value: unknown) => {
	const result = publishableItemSlugSchema.safeParse(value);
	return result.success ? undefined : result.error.issues[0]?.message;
};

describe("publishableItemTypeSchema", () => {
	it.each([
		["ASSURANCE_CASE", true],
		["ARGUMENT_PATTERN", true],
		["", false],
		["CASE", false],
	])("accepts %j: %s", (value, ok) => {
		expect(publishableItemTypeSchema.safeParse(value).success).toBe(ok);
	});
});

describe("publishableItemSlugSchema", () => {
	it.each([
		"a",
		"7",
		"my-case",
		"my-case-2",
		"a1-b2-c3",
		"a".repeat(255),
	])("accepts %j", (slug) => {
		expect(publishableItemSlugSchema.safeParse(slug).success).toBe(true);
	});

	it.each([
		["Upper", "uppercase letters"],
		["-leading", "a leading hyphen"],
		["trailing-", "a trailing hyphen"],
		["double--hyphen", "a double hyphen"],
		["under_score", "an underscore"],
		["with space", "a space"],
		["a-b-", "a trailing hyphen after segments"],
		["!x", "a symbol before the slug"],
		["x!", "a symbol after the slug"],
		["a-!", "a symbol in a later segment"],
		["!-a", "a symbol in the first segment"],
		["ab-c d", "a space in a later segment"],
	])("refuses %j with the format message (%s)", (slug) => {
		expect(messageOf(slug)).toBe("Invalid slug format");
	});

	it("accepts a slug with several multi-character segments", () => {
		expect(publishableItemSlugSchema.safeParse("ab-cd-ef").success).toBe(true);
	});

	it("says a slug is required when it is empty", () => {
		expect(messageOf("")).toBe("Slug is required");
	});

	it("refuses a slug of 256 characters, saying so", () => {
		expect(messageOf("a".repeat(256))).toBe(
			"Slug must be less than 255 characters"
		);
	});
});

describe("publishedSnapshotMetaSchema", () => {
	it("keeps the case name and description and the case information", () => {
		const content = {
			case: { name: "Case", description: "About it" },
			caseInformation: {
				description: "Public text",
				authors: "Ada",
				sector: "Energy",
				featureImageUrl: null,
			},
		};
		expect(publishedSnapshotMetaSchema.parse(content)).toEqual(content);
	});

	it("drops keys it does not read and accepts a snapshot without either part", () => {
		expect(
			publishedSnapshotMetaSchema.parse({ tree: {}, case: { extra: 1 } })
		).toEqual({ case: {} });
		expect(publishedSnapshotMetaSchema.parse({})).toEqual({});
	});
});
