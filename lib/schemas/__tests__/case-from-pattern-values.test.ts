import { describe, expect, it } from "vitest";
import {
	createCaseFromPatternSchema,
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

describe("variableValuesSchema — messages", () => {
	it("says how long a value may be", () => {
		const result = variableValuesSchema.safeParse({ a: "x".repeat(501) });
		expect(result.error?.issues[0]?.message).toBe(
			"Variable values must be at most 500 characters"
		);
	});
});

describe("createCaseFromPatternSchema", () => {
	const uuid = "11111111-1111-4111-8111-111111111111";
	const base = {
		source: { patternCaseId: uuid },
		name: "My case",
		description: "About it",
	};

	it("keeps the source, name and description, with no variable values by default", () => {
		expect(createCaseFromPatternSchema.parse(base)).toEqual({
			...base,
			variableValues: {},
		});
	});

	it("keeps variable values that are given, trimmed", () => {
		const parsed = createCaseFromPatternSchema.parse({
			...base,
			variableValues: { abcde12345: " v " },
		});
		expect(parsed.variableValues).toEqual({ abcde12345: "v" });
	});

	it.each([
		["a pattern case id", { patternCaseId: uuid }, true],
		["a published slug", { publishedSlug: "my-pattern" }, true],
		["both keys", { patternCaseId: uuid, publishedSlug: "my-pattern" }, false],
		["a case id that is not a UUID", { patternCaseId: "1" }, false],
		["a slug with capitals", { publishedSlug: "My" }, false],
		["no key", {}, false],
	])("handles a source given as %s", (_label, source, ok) => {
		const result = createCaseFromPatternSchema.safeParse({ ...base, source });
		expect(result.success).toBe(ok);
	});

	it("asks the person to choose a pattern when the source is wrong", () => {
		const result = createCaseFromPatternSchema.safeParse({
			...base,
			source: {},
		});
		expect(result.error?.issues[0]?.message).toBe(
			"Choose a pattern to start from"
		);
	});

	it("names the description when it is blank", () => {
		const result = createCaseFromPatternSchema.safeParse({
			...base,
			description: "  ",
		});
		const messages = result.error?.issues.map((issue) => issue.message);
		expect(messages?.length).toBeGreaterThan(0);
		expect(messages?.every((m) => m === "Description is required")).toBe(true);
	});
});

describe("protoKeyProblem", () => {
	it("gives the message people see when a value has no variable to go to", () => {
		const values = JSON.parse('{"__proto__": "x"}');
		expect(protoKeyProblem(values)).toBe(
			"That pattern has no variable to give that value to"
		);
	});

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
