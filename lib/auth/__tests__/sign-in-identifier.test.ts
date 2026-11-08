import { createHash, createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KELVIN_SIGN } from "@/src/__tests__/helpers/identifier-characters";
import {
	isEmailName,
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
const SECRET = "sign-in-identifier-test-secret";

beforeEach(() => {
	vi.stubEnv("NEXTAUTH_SECRET", SECRET);
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("isEmailName", () => {
	it("is true for a name containing @ and false for any other", () => {
		expect(isEmailName("Demo@Example.com")).toBe(true);
		expect(isEmailName("  demo@example.com ")).toBe(true);
		expect(isEmailName("Demo")).toBe(false);
	});
});

describe("signInIdentifierKey", () => {
	it("gives every ASCII capitalisation of an email, with or without surrounding spaces, one key", () => {
		expect(signInIdentifierKey(" Demo@Example.com\t")).toBe(
			signInIdentifierKey("demo@example.com")
		);
	});

	it("keeps a username exactly as typed, so Alice and alice have two keys", () => {
		expect(signInIdentifierKey("Alice")).not.toBe(signInIdentifierKey("alice"));
		expect(signInIdentifierKey(" Alice ")).toBe(signInIdentifierKey("Alice"));
	});

	it("never folds a capital outside A to Z", () => {
		expect(signInIdentifierKey(`${KELVIN_SIGN}@example.com`)).not.toBe(
			signInIdentifierKey("k@example.com")
		);
		expect(signInIdentifierKey(`${KELVIN_SIGN}elvin`)).not.toBe(
			signInIdentifierKey("kelvin")
		);
	});

	it("is a keyed hash that does not contain the name", () => {
		const key = signInIdentifierKey("correct horse battery");

		expect(key).toMatch(SHA256_HEX);
		expect(key).not.toContain("horse");
		expect(signInIdentifierKey("another name")).not.toBe(key);
	});

	it("is not the plain SHA-256 of the name, and changes with the secret", () => {
		const key = signInIdentifierKey("correct horse battery");

		expect(key).not.toBe(
			createHash("sha256").update("correct horse battery").digest("hex")
		);
		vi.stubEnv("NEXTAUTH_SECRET", "a different secret");
		expect(signInIdentifierKey("correct horse battery")).not.toBe(key);
	});

	it("is not a bare HMAC of the name, so it never equals a signature made for another purpose under the same secret", () => {
		expect(signInIdentifierKey("some.signed.value")).not.toBe(
			createHmac("sha256", SECRET).update("some.signed.value").digest("hex")
		);
	});

	it("throws when no secret is configured, rather than keying with nothing", () => {
		vi.stubEnv("NEXTAUTH_SECRET", "");

		expect(() => signInIdentifierKey("demo")).toThrow("NEXTAUTH_SECRET");
	});

	it("looks only at the first 256 characters of a very long value", () => {
		const head = "a".repeat(256);

		expect(signInIdentifierKey(`${head}x`)).toBe(signInIdentifierKey(head));
		expect(signInIdentifierKey(`${head.slice(1)}x`)).not.toBe(
			signInIdentifierKey(head)
		);
	});
});
