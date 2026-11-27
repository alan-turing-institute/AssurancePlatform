import { describe, expect, it } from "vitest";
import {
	ASSERTION_STATUS_DESCRIPTIONS,
	ASSERTION_STATUS_LABELS,
	AUTHOR_ASSERTION_STATUS_VALUES,
	AuthorAssertionStatusSchema,
	isAssertionStatusValue,
	isAuthorAssertionStatusValue,
} from "@/lib/assertion-status";
import { AssertionStatusSchema } from "@/lib/schemas/case-export";

const AUTHOR_VALUES = [
	"ASSERTED",
	"NEEDS_SUPPORT",
	"ASSUMED",
	"AXIOMATIC",
	"DEFEATED",
];
const ALL_VALUES = [...AUTHOR_VALUES, "AS_CITED"];

const NEAR_MISSES = [
	"asserted",
	"Asserted",
	" ASSERTED",
	"ASSERTED ",
	"NEEDS SUPPORT",
	"as_cited",
	"AS_CITED\n",
	"",
	"UNKNOWN",
];
const NON_STRINGS = [undefined, null, 0, 1, true, {}, [], ["ASSERTED"]];

describe("author-declarable status list", () => {
	it("holds exactly the five author values, without the derived one", () => {
		expect([...AUTHOR_ASSERTION_STATUS_VALUES].sort()).toStrictEqual(
			[...AUTHOR_VALUES].sort()
		);
	});

	it.each(AUTHOR_VALUES)("schema accepts %s", (value) => {
		expect(AuthorAssertionStatusSchema.safeParse(value).success).toBe(true);
	});

	it("schema rejects the derived value", () => {
		expect(AuthorAssertionStatusSchema.safeParse("AS_CITED").success).toBe(
			false
		);
	});
});

describe("isAssertionStatusValue", () => {
	it.each(ALL_VALUES)("accepts %s", (value) => {
		expect(isAssertionStatusValue(value)).toBe(true);
	});

	it.each(NEAR_MISSES)("rejects the near miss %j", (value) => {
		expect(isAssertionStatusValue(value)).toBe(false);
	});

	it.each(NON_STRINGS)("rejects the non-string %j", (value) => {
		expect(isAssertionStatusValue(value)).toBe(false);
	});
});

describe("isAuthorAssertionStatusValue", () => {
	it.each(AUTHOR_VALUES)("accepts %s", (value) => {
		expect(isAuthorAssertionStatusValue(value)).toBe(true);
	});

	it("rejects the derived value that the wider guard accepts", () => {
		expect(isAssertionStatusValue("AS_CITED")).toBe(true);
		expect(isAuthorAssertionStatusValue("AS_CITED")).toBe(false);
	});

	it.each(NEAR_MISSES)("rejects the near miss %j", (value) => {
		expect(isAuthorAssertionStatusValue(value)).toBe(false);
	});

	it.each(NON_STRINGS)("rejects the non-string %j", (value) => {
		expect(isAuthorAssertionStatusValue(value)).toBe(false);
	});
});

describe.each([
	["labels", ASSERTION_STATUS_LABELS],
	["descriptions", ASSERTION_STATUS_DESCRIPTIONS],
])("assertion status %s", (_name, table) => {
	it("has an entry for every status in the schema and nothing else", () => {
		expect(Object.keys(table).sort()).toStrictEqual(
			[...AssertionStatusSchema.options].sort()
		);
	});

	it.each(ALL_VALUES)("has a non-empty entry for %s", (status) => {
		const text = (table as Record<string, string>)[status];
		expect(typeof text).toBe("string");
		expect(text?.trim().length).toBeGreaterThan(0);
	});

	it("gives every status a different entry", () => {
		const texts = Object.values(table);
		expect(new Set(texts).size).toBe(texts.length);
	});
});
