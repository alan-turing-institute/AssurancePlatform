import { describe, expect, it } from "vitest";
import {
	buildHealthCheckList,
	ITEM_CHECK_NAME,
} from "../../../src/__tests__/fixtures/health-checks";
import { healthCheckListSchema, MAX_PUBLISHED_CHECKS } from "../health-checks";

function fieldsOf(list: unknown): string[] {
	const parsed = healthCheckListSchema.safeParse(list);
	return parsed.success
		? []
		: parsed.error.issues.map((issue) => issue.path.join("."));
}

const minimalCheck = (name: string) => ({
	name,
	version: "1",
	scope: "item",
	value: { type: "boolean" },
});

describe("check list schema", () => {
	it("accepts the demo list", () => {
		expect(
			healthCheckListSchema.safeParse(buildHealthCheckList()).success
		).toBe(true);
	});

	it("accepts exactly 200 checks and refuses 201", () => {
		const list = (count: number) => ({
			pipeline: "p",
			checks: Array.from({ length: count }, (_, i) => minimalCheck(`c${i}`)),
		});
		expect(
			healthCheckListSchema.safeParse(list(MAX_PUBLISHED_CHECKS)).success
		).toBe(true);
		expect(
			healthCheckListSchema.safeParse(list(MAX_PUBLISHED_CHECKS + 1)).success
		).toBe(false);
	});

	it("refuses a duplicate check name and names it", () => {
		expect(
			fieldsOf({
				pipeline: "p",
				checks: [minimalCheck("a"), minimalCheck("a")],
			})
		).toEqual(["checks.1.name"]);
	});

	it("refuses unknown keys at the top and on a check", () => {
		expect(fieldsOf({ ...buildHealthCheckList(), extra: 1 })).toEqual([""]);
		expect(
			fieldsOf({
				pipeline: "p",
				checks: [{ ...minimalCheck("a"), colour: "red" }],
			})
		).toEqual(["checks.0"]);
	});

	it("refuses names and versions with edge whitespace", () => {
		expect(
			fieldsOf({ pipeline: "p", checks: [minimalCheck(" padded")] })
		).toEqual(["checks.0.name"]);
		expect(
			fieldsOf({
				pipeline: "p",
				checks: [{ ...minimalCheck("a"), version: "1 " }],
			})
		).toEqual(["checks.0.version"]);
	});

	it("refuses an enum setting without options and a default of the wrong type", () => {
		const withParam = (param: Record<string, unknown>) => ({
			pipeline: "p",
			checks: [{ ...minimalCheck("a"), params: [param] }],
		});
		expect(fieldsOf(withParam({ key: "k", label: "K", type: "enum" }))).toEqual(
			["checks.0.params.0.options"]
		);
		expect(
			fieldsOf(
				withParam({ key: "k", label: "K", type: "number", default: "x" })
			)
		).toEqual(["checks.0.params.0.default"]);
	});

	it("refuses options on a setting that is not an enum, and a default that does not fit each type", () => {
		const withParam = (param: Record<string, unknown>) => ({
			pipeline: "p",
			checks: [{ ...minimalCheck("a"), params: [param] }],
		});
		const fields = (param: Record<string, unknown>) =>
			fieldsOf(withParam({ key: "k", label: "K", ...param }));
		expect(fields({ type: "string", options: ["x"] })).toEqual([
			"checks.0.params.0.options",
		]);
		for (const param of [
			{ type: "string", default: 5 },
			{ type: "boolean", default: "yes" },
			{ type: "duration", default: 5 },
			{ type: "duration", default: "" },
			{ type: "enum", options: ["x", "y"], default: "z" },
		]) {
			expect(fields(param), JSON.stringify(param)).toEqual([
				"checks.0.params.0.default",
			]);
		}
		for (const param of [
			{ type: "string", default: "s" },
			{ type: "number", default: 5 },
			{ type: "boolean", default: false },
			{ type: "duration", default: "PT5M" },
			{ type: "enum", options: ["x", "y"], default: "y" },
		]) {
			expect(fields(param), JSON.stringify(param)).toEqual([]);
		}
	});

	it("refuses a prototype key in a recommendation's parameters and in a rule's parameters", () => {
		const list = JSON.parse(
			'{"pipeline":"p","checks":[{"name":"a","version":"1","scope":"item","value":{"type":"boolean"},"recommended":{"rule":{"kind":"identity","params":{"__proto__":{"x":1}}}}}]}'
		);
		expect(fieldsOf(list)).toEqual([
			"checks.0.recommended.rule.params.__proto__",
		]);
	});

	it("refuses text a database cannot store", () => {
		expect(
			fieldsOf({
				pipeline: "p",
				checks: [{ ...minimalCheck("a"), description: "bad\u0000" }],
			})
		).toEqual(["checks.0.description"]);
	});

	it("checks a recommendation for shape only", () => {
		const withRecommended = (recommended: unknown) => ({
			pipeline: "p",
			checks: [{ ...minimalCheck(ITEM_CHECK_NAME), recommended }],
		});
		// A recommendation that would fail as settings still has a valid shape.
		expect(
			fieldsOf(
				withRecommended({
					rule: { kind: "threshold", direction: "target" },
					window: "P1M",
				})
			)
		).toEqual([]);
		expect(fieldsOf(withRecommended({ colour: "red" }))).toEqual([
			"checks.0.recommended",
		]);
	});
});
