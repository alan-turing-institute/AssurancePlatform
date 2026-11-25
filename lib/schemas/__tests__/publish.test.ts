import { describe, expect, it } from "vitest";
import { publishCaseBodySchema } from "../publish";

describe("publishCaseBodySchema", () => {
	it("keeps the version note, trimmed", () => {
		expect(publishCaseBodySchema.parse({ description: " Initial " })).toEqual({
			description: "Initial",
		});
	});

	it("accepts a body with no note", () => {
		expect(publishCaseBodySchema.parse({}).description).toBeUndefined();
	});

	it.each([
		[2000, true],
		[2001, false],
	])("accepts a note of %i characters: %s", (length, ok) => {
		const result = publishCaseBodySchema.safeParse({
			description: "d".repeat(length),
		});
		expect(result.success).toBe(ok);
	});

	it("refuses a key it does not know", () => {
		expect(publishCaseBodySchema.safeParse({ other: 1 }).success).toBe(false);
	});
});
