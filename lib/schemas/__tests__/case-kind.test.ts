import { describe, expect, it } from "vitest";
import { convertCaseKindSchema } from "../case-kind";

const CASE_ID = "11111111-1111-4111-8111-111111111111";

describe("convertCaseKindSchema", () => {
	it.each(["CASE", "PATTERN"])("accepts the target kind %s", (targetKind) => {
		expect(
			convertCaseKindSchema.parse({ caseId: CASE_ID, targetKind })
		).toEqual({ caseId: CASE_ID, targetKind });
	});

	it.each([
		["a target kind that is not known", { caseId: CASE_ID, targetKind: "X" }],
		["a case id that is not a UUID", { caseId: "1", targetKind: "CASE" }],
		["no target kind", { caseId: CASE_ID }],
	])("refuses %s", (_label, body) => {
		expect(convertCaseKindSchema.safeParse(body).success).toBe(false);
	});
});
