import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLinkIntent, verifyLinkIntent } from "../link-intent";

const TEST_SECRET = "a-test-nextauth-secret-value";

/**
 * Builds a token from an arbitrary base64url payload with a REAL signature
 * over it — same construction as the module's own (unexported) `sign()`.
 * Needed for malformed-payload cases below: pairing a bad payload with a
 * throwaway signature string (as the shape-only cases above do) fails the
 * signature check first, so the payload-decoding branch it's meant to
 * exercise is never reached.
 */
function signedToken(payloadB64: string): string {
	const signature = createHmac("sha256", TEST_SECRET)
		.update(payloadB64)
		.digest("base64url");
	return `${payloadB64}.${signature}`;
}

describe("createLinkIntent / verifyLinkIntent", () => {
	beforeEach(() => {
		vi.stubEnv("NEXTAUTH_SECRET", TEST_SECRET);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("round-trips: a token created for a user and provider verifies to that user id", () => {
		const token = createLinkIntent({ userId: "user-1", provider: "github" });

		expect(verifyLinkIntent(token, { provider: "github" })).toEqual({
			userId: "user-1",
		});
	});

	it("rejects a token whose payload was tampered with", () => {
		const token = createLinkIntent({ userId: "user-1", provider: "github" });
		const [payloadB64, signatureB64] = token.split(".");
		const tamperedPayload = Buffer.from(
			JSON.stringify({
				...JSON.parse(
					Buffer.from(payloadB64 as string, "base64url").toString()
				),
				u: "user-2",
			})
		).toString("base64url");

		expect(
			verifyLinkIntent(`${tamperedPayload}.${signatureB64}`, {
				provider: "github",
			})
		).toBeNull();
	});

	it("rejects a token whose signature was tampered with", () => {
		const token = createLinkIntent({ userId: "user-1", provider: "github" });
		const [payloadB64] = token.split(".");

		expect(
			verifyLinkIntent(`${payloadB64}.not-the-real-signature`, {
				provider: "github",
			})
		).toBeNull();
	});

	it("rejects an expired token", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
		const token = createLinkIntent({ userId: "user-1", provider: "github" });

		vi.setSystemTime(new Date("2026-01-01T00:05:01Z")); // one second past the 5-minute window

		expect(verifyLinkIntent(token, { provider: "github" })).toBeNull();
		vi.useRealTimers();
	});

	it("rejects a token exactly at its expiry second (exp is exclusive, RFC 7519)", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
		const token = createLinkIntent({ userId: "user-1", provider: "github" });

		vi.setSystemTime(new Date("2026-01-01T00:05:00Z")); // exactly the 5-minute boundary

		expect(verifyLinkIntent(token, { provider: "github" })).toBeNull();
		vi.useRealTimers();
	});

	it("accepts a token one second before its expiry boundary", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
		const token = createLinkIntent({ userId: "user-1", provider: "github" });

		vi.setSystemTime(new Date("2026-01-01T00:04:59Z")); // one second before the boundary

		expect(verifyLinkIntent(token, { provider: "github" })).toEqual({
			userId: "user-1",
		});
		vi.useRealTimers();
	});

	it("rejects a token verified against a different provider than it was issued for", () => {
		const token = createLinkIntent({ userId: "user-1", provider: "github" });

		expect(verifyLinkIntent(token, { provider: "google" })).toBeNull();
	});

	// These three fail before any signature is ever checked (bad shape, not
	// bad content), so a throwaway signature string is fine here.
	it.each([
		["an empty string", ""],
		["a string with no separator", "no-dot-here"],
		["a string with three parts", "a.b.c"],
	])("returns null for a malformed token (%s)", (_label, token) => {
		expect(verifyLinkIntent(token, { provider: "github" })).toBeNull();
	});

	it("returns null for a two-part token with an empty payload half", () => {
		expect(
			verifyLinkIntent(".some-signature", { provider: "github" })
		).toBeNull();
	});

	it("returns null for a two-part token with an empty signature half", () => {
		const payloadB64 = Buffer.from(
			JSON.stringify({
				u: "user-1",
				p: "github",
				n: "nonce",
				exp: 9_999_999_999,
			})
		).toString("base64url");

		expect(
			verifyLinkIntent(`${payloadB64}.`, { provider: "github" })
		).toBeNull();
	});

	it("returns null for a validly-signed payload that decodes to non-JSON bytes", () => {
		const token = signedToken(Buffer.from("not json").toString("base64url"));

		expect(verifyLinkIntent(token, { provider: "github" })).toBeNull();
	});

	it("returns null for a validly-signed payload whose JSON is missing required fields", () => {
		const token = signedToken(
			Buffer.from(JSON.stringify({ u: "user-1" })).toString("base64url")
		);

		expect(verifyLinkIntent(token, { provider: "github" })).toBeNull();
	});

	it("returns null for a validly-signed payload whose exp is a string, not a number", () => {
		const token = signedToken(
			Buffer.from(
				JSON.stringify({ u: "user-1", p: "github", n: "nonce", exp: "soon" })
			).toString("base64url")
		);

		expect(verifyLinkIntent(token, { provider: "github" })).toBeNull();
	});

	it("returns null, without throwing, when NEXTAUTH_SECRET is unset at verify time", () => {
		vi.unstubAllEnvs();
		Reflect.deleteProperty(process.env, "NEXTAUTH_SECRET");

		expect(verifyLinkIntent("abc.def", { provider: "github" })).toBeNull();
	});

	it("throws when NEXTAUTH_SECRET is not configured", () => {
		vi.unstubAllEnvs();
		Reflect.deleteProperty(process.env, "NEXTAUTH_SECRET");

		expect(() =>
			createLinkIntent({ userId: "user-1", provider: "github" })
		).toThrow(
			"NEXTAUTH_SECRET must be configured to sign account-link intents"
		);
	});
});
