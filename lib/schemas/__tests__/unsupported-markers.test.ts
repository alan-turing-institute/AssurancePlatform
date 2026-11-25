import { describe, expect, it } from "vitest";
import { unsupportedMarkerSettingSchema } from "../unsupported-markers";

describe("unsupportedMarkerSettingSchema", () => {
	it.each([true, false])("keeps show: %s", (show) => {
		expect(unsupportedMarkerSettingSchema.parse({ show })).toEqual({ show });
	});

	it.each([
		["a string", { show: "false" }],
		["a number", { show: 0 }],
		["no value", {}],
		["an extra key", { show: true, other: 1 }],
	])("refuses %s", (_label, body) => {
		expect(unsupportedMarkerSettingSchema.safeParse(body).success).toBe(false);
	});
});
