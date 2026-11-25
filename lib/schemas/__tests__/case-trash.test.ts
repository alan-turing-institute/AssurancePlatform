import { describe, expect, it } from "vitest";
import { deleteCaseRequestSchema } from "../case-trash";

const CASE_ID = "11111111-1111-4111-8111-111111111111";

describe("deleteCaseRequestSchema", () => {
	it("fills in empty options when none are given", () => {
		expect(deleteCaseRequestSchema.parse({ caseId: CASE_ID })).toEqual({
			caseId: CASE_ID,
			options: {},
		});
	});

	it.each([
		"archive",
		"remove",
	])("keeps the published copy choice %s", (choice) => {
		const parsed = deleteCaseRequestSchema.parse({
			caseId: CASE_ID,
			options: { publishedCopy: choice },
		});
		expect(parsed.options.publishedCopy).toBe(choice);
	});

	it.each([
		["a published copy choice that is not known", { publishedCopy: "keep" }],
		["an empty published copy choice", { publishedCopy: "" }],
		["an option that is not known", { other: true }],
	])("refuses %s", (_label, options) => {
		const result = deleteCaseRequestSchema.safeParse({
			caseId: CASE_ID,
			options,
		});
		expect(result.success).toBe(false);
	});

	it("refuses a case id that is not a UUID", () => {
		expect(deleteCaseRequestSchema.safeParse({ caseId: "1" }).success).toBe(
			false
		);
	});
});
