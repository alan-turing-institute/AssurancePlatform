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

	it("returns 'description' when the record exists but description is empty", () => {
		expect(getMissingCaseInformationFields({ description: "" })).toStrictEqual([
			"description",
		]);
		expect(
			getMissingCaseInformationFields({ description: null })
		).toStrictEqual(["description"]);
	});

	it("treats a whitespace-only description as missing", () => {
		expect(
			getMissingCaseInformationFields({ description: "   " })
		).toStrictEqual(["description"]);
	});

	it("returns an empty list once description is present", () => {
		expect(
			getMissingCaseInformationFields({ description: "A worked example" })
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
