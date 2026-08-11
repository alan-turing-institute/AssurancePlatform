import { describe, expect, it } from "vitest";
import {
	CASE_INFORMATION_FIELD_LABELS,
	getMissingCaseInformationFields,
	REQUIRED_CASE_INFORMATION_FIELDS,
	upsertCaseInformationSchema,
} from "../case-information";

describe("getMissingCaseInformationFields (ADR 0003 §4 — the publish gate)", () => {
	it("returns every required field when there is no record at all", () => {
		expect(getMissingCaseInformationFields(null)).toStrictEqual([
			...REQUIRED_CASE_INFORMATION_FIELDS,
		]);
		expect(getMissingCaseInformationFields(undefined)).toStrictEqual([
			...REQUIRED_CASE_INFORMATION_FIELDS,
		]);
	});

	it("requires description, authors AND sector (Chris's ruling, 2026-08-11)", () => {
		expect(REQUIRED_CASE_INFORMATION_FIELDS).toStrictEqual([
			"description",
			"authors",
			"sector",
		]);
	});

	it("returns only the fields that are blank, not every required field", () => {
		expect(
			getMissingCaseInformationFields({
				description: "",
				authors: "Ada Lovelace",
				sector: "Healthcare",
			})
		).toStrictEqual(["description"]);
		expect(
			getMissingCaseInformationFields({
				description: "A worked example",
				authors: null,
				sector: "Healthcare",
			})
		).toStrictEqual(["authors"]);
		expect(
			getMissingCaseInformationFields({
				description: "A worked example",
				authors: "Ada Lovelace",
				sector: "",
			})
		).toStrictEqual(["sector"]);
	});

	it("treats a whitespace-only value as missing, for any required field", () => {
		expect(
			getMissingCaseInformationFields({
				description: "   ",
				authors: "Ada Lovelace",
				sector: "Healthcare",
			})
		).toStrictEqual(["description"]);
		expect(
			getMissingCaseInformationFields({
				description: "A worked example",
				authors: "   ",
				sector: "Healthcare",
			})
		).toStrictEqual(["authors"]);
	});

	it("returns an empty list once description, authors and sector are all present, feature image not required", () => {
		expect(
			getMissingCaseInformationFields({
				description: "A worked example",
				authors: "Ada Lovelace",
				sector: "Healthcare",
			})
		).toStrictEqual([]);
	});

	it("has a human-readable label for every required field", () => {
		for (const field of REQUIRED_CASE_INFORMATION_FIELDS) {
			expect(CASE_INFORMATION_FIELD_LABELS[field]).toBeTruthy();
		}
	});
});

describe("upsertCaseInformationSchema — unaffected by the publish gate", () => {
	it("still accepts a save with no description (case information stays saveable in partial states)", () => {
		const result = upsertCaseInformationSchema.safeParse({
			authors: "Ada Lovelace",
		});
		expect(result.success).toBe(true);
	});
});
