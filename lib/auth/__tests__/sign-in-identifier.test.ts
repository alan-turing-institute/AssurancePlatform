import { describe, expect, it } from "vitest";
import { normaliseSignInIdentifier } from "../sign-in-identifier";

describe("normaliseSignInIdentifier", () => {
	it("removes spaces, tabs and line breaks from both ends", () => {
		expect(normaliseSignInIdentifier("  demo \t\n")).toBe("demo");
	});

	it("keeps capitals and inner spaces", () => {
		expect(normaliseSignInIdentifier(" Demo@Example.com ")).toBe(
			"Demo@Example.com"
		);
		expect(normaliseSignInIdentifier("a b")).toBe("a b");
	});

	it("returns null for an empty or all-space value", () => {
		expect(normaliseSignInIdentifier("")).toBeNull();
		expect(normaliseSignInIdentifier("   \t ")).toBeNull();
	});

	it.each([
		undefined,
		null,
		42,
		{ username: "demo" },
		["demo"],
	])("returns null for the non-string value %j", (value) => {
		expect(normaliseSignInIdentifier(value)).toBeNull();
	});
});
