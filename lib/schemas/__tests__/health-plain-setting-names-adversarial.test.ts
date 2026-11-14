import { describe, expect, it } from "vitest";
import { healthCheckListSchema } from "../health-checks";
import { recommendedCheckParams } from "../health-criteria";

const listWithSettingNamed = (name: string) =>
	JSON.parse(
		`{"pipeline":"p","checks":[{"name":"c","version":"1","scope":"item","value":{"type":"number"},"params":{${JSON.stringify(name)}:"x","ok":1}}]}`
	);

describe("a setting named like an object's prototype in a plain settings object", () => {
	it("is refused by name, as the settings of a claim refuse it", () => {
		const result = healthCheckListSchema.safeParse(
			listWithSettingNamed("__proto__")
		);
		expect(result.success).toBe(false);
	});

	it("is not left as a setting whose default disappears when the defaults are read", () => {
		const result = healthCheckListSchema.safeParse(
			listWithSettingNamed("__proto__")
		);
		if (result.success) {
			const [check] = result.data.checks;
			const keys = (check?.params ?? []).map((param) => param.key);
			const defaults = check ? recommendedCheckParams(check) : {};
			for (const key of keys) {
				expect(Object.hasOwn(defaults, key), key).toBe(true);
			}
		}
		expect(({} as Record<string, unknown>).x).toBeUndefined();
	});
});
