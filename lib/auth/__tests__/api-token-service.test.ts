import { describe, expect, it } from "vitest";
import {
	generateApiTokenSecret,
	hashApiTokenSecret,
	looksLikeApiToken,
	TOKEN_PREFIX,
	tokenDisplayPrefix,
} from "../api-token-service";

const URL_SAFE_BODY = /^[A-Za-z0-9_-]{43}$/;

// Made once, as SHA-256 in hex of the UTF-8 bytes of each text.
const HASH_OF_ASCII_SECRET =
	"ac09545ecf4dd953295c11c690ab480b373b2af562b0003c63255ea937c3ee42";
const HASH_OF_NON_ASCII_SECRET =
	"52ebe80825b8383668a0485fa820b16a645525faf1b9af9f7f0775fb9f3b3011";

describe("generateApiTokenSecret", () => {
	it("starts with the fixed prefix", () => {
		expect(TOKEN_PREFIX).toBe("teap_");
		expect(generateApiTokenSecret().startsWith("teap_")).toBe(true);
	});

	it("has a URL-safe body of 256 bits after the prefix", () => {
		const body = generateApiTokenSecret().slice(TOKEN_PREFIX.length);
		expect(body).toMatch(URL_SAFE_BODY);
	});

	it("makes a different secret each time", () => {
		expect(generateApiTokenSecret()).not.toBe(generateApiTokenSecret());
	});

	it("makes secrets that pass the shape check", () => {
		expect(looksLikeApiToken(generateApiTokenSecret())).toBe(true);
	});
});

describe("hashApiTokenSecret", () => {
	it("gives the known SHA-256 hex digest of a secret", () => {
		expect(hashApiTokenSecret("teap_test-secret")).toBe(HASH_OF_ASCII_SECRET);
	});

	it("hashes the UTF-8 bytes of a secret that has non-ASCII characters", () => {
		expect(hashApiTokenSecret("teap_tökén-✓")).toBe(HASH_OF_NON_ASCII_SECRET);
	});

	it("gives the same hash for the same input and another for a different input", () => {
		expect(hashApiTokenSecret("teap_a")).toBe(hashApiTokenSecret("teap_a"));
		expect(hashApiTokenSecret("teap_a")).not.toBe(hashApiTokenSecret("teap_b"));
	});
});

describe("tokenDisplayPrefix", () => {
	it("keeps the first 12 characters", () => {
		expect(tokenDisplayPrefix("teap_0123456789abcdef")).toBe("teap_0123456");
	});

	it("returns a shorter secret whole", () => {
		expect(tokenDisplayPrefix("teap_01")).toBe("teap_01");
	});
});

describe("looksLikeApiToken", () => {
	it.each([
		["a prefix and one character", "teap_x"],
		["a prefix and a long body", "teap_0123456789abcdef"],
	])("accepts %s", (_label, value) => {
		expect(looksLikeApiToken(value)).toBe(true);
	});

	it.each([
		["the prefix alone", "teap_"],
		["an empty string", ""],
		["a long value with no prefix", "not-a-machine-token-value"],
		["a different prefix", "teaq_0123456789"],
		["the prefix in the middle", "xteap_0123456789"],
		["the prefix in capitals", "TEAP_0123456789"],
	])("refuses %s", (_label, value) => {
		expect(looksLikeApiToken(value)).toBe(false);
	});
});
