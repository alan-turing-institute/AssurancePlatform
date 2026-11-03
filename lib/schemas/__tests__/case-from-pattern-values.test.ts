import { describe, expect, it } from "vitest";
import {
	NOT_A_VARIABLE_MESSAGE,
	protoKeyProblem,
	variableValuesSchema,
} from "../case-from-pattern";

describe("variableValuesSchema", () => {
	it("trims each value of spaces and zero-width characters", () => {
		const parsed = variableValuesSchema.parse({
			a: "  AcmeBot ",
			b: "​‌‍⁠",
			c: " ​ ",
		});

		expect(parsed).toEqual({ a: "AcmeBot", b: "", c: "" });
	});

	it("counts the length after trimming, and refuses a value over 500 characters", () => {
		expect(
			variableValuesSchema.safeParse({ a: `​${"x".repeat(500)}​` }).success
		).toBe(true);
		expect(variableValuesSchema.safeParse({ a: "x".repeat(501) }).success).toBe(
			false
		);
	});
});

describe("protoKeyProblem", () => {
	it("refuses values with an own key called __proto__, however its value looks", () => {
		for (const value of ["x", { polluted: "yes" }, null]) {
			const values = JSON.parse(
				`{"__proto__": ${JSON.stringify(value)}, "k3f9x2m7qa": "x"}`
			);
			expect(protoKeyProblem(values)).toBe(NOT_A_VARIABLE_MESSAGE);
		}
	});

	it("has nothing to say about other values, including ones that are not objects", () => {
		for (const values of [
			{},
			{ k3f9x2m7qa: "x" },
			{ constructor: "x" },
			null,
			undefined,
			"__proto__",
			["x"],
		]) {
			expect(protoKeyProblem(values)).toBeUndefined();
		}
	});
});
