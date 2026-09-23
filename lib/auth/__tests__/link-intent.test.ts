import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLinkIntent, verifyLinkIntent } from "../link-intent";

const TEST_SECRET = "a-test-nextauth-secret-value";

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

	it.each([
		["an empty string", ""],
		["a string with no separator", "no-dot-here"],
		["a string with three parts", "a.b.c"],
		["a payload half that isn't base64", "!!!not-base64!!!.signature"],
		[
			"a payload half that decodes to non-JSON",
			`${Buffer.from("not json").toString("base64url")}.signature`,
		],
		[
			"a payload half that decodes to JSON missing required fields",
			`${Buffer.from(JSON.stringify({ u: "user-1" })).toString("base64url")}.signature`,
		],
	])("returns null for a malformed token (%s)", (_label, token) => {
		expect(verifyLinkIntent(token, { provider: "github" })).toBeNull();
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
