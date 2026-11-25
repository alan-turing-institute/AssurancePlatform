import { describe, expect, it } from "vitest";
import { updateCaseStatusSchema } from "../status";

describe("updateCaseStatusSchema", () => {
	it.each(["DRAFT", "PUBLISHED"])("accepts the target status %s", (status) => {
		expect(
			updateCaseStatusSchema.parse({ targetStatus: status, description: "n" })
		).toEqual({ targetStatus: status, description: "n" });
	});

	it.each([
		"",
		"ARCHIVED",
		"draft",
	])("refuses the target status %j, saying which values are allowed", (status) => {
		const result = updateCaseStatusSchema.safeParse({ targetStatus: status });
		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toBe(
			"Invalid targetStatus. Must be one of: DRAFT, PUBLISHED"
		);
	});

	it.each([
		[5000, true],
		[5001, false],
	])("accepts a note of %i characters: %s", (length, ok) => {
		const result = updateCaseStatusSchema.safeParse({
			targetStatus: "DRAFT",
			description: "d".repeat(length),
		});
		expect(result.success).toBe(ok);
	});
});
