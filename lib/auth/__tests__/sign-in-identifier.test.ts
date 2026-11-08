import { describe, expect, it } from "vitest";
import {
	normaliseSignInIdentifier,
	signInIdentifierKey,
} from "../sign-in-identifier";

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

const SHA256_HEX = /^[0-9a-f]{64}$/;

describe("signInIdentifierKey", () => {
	it("gives every capitalisation of a name, with or without surrounding spaces, one key", () => {
		expect(signInIdentifierKey(" Demo@Example.com\t")).toBe(
			signInIdentifierKey("demo@example.com")
		);
	});

	it("is a hash that does not contain the name", () => {
		const key = signInIdentifierKey("correct horse battery");

		expect(key).toMatch(SHA256_HEX);
		expect(key).not.toContain("horse");
		expect(signInIdentifierKey("another name")).not.toBe(key);
	});

	it("looks only at the first 256 characters of a very long value", () => {
		const head = "a".repeat(256);

		expect(signInIdentifierKey(`${head}x`)).toBe(signInIdentifierKey(head));
		expect(signInIdentifierKey(`${head.slice(1)}x`)).not.toBe(
			signInIdentifierKey(head)
		);
	});
});
