import { describe, expect, it } from "vitest";
import { googleNeedsReauthorisation } from "../google-account-status";

describe("googleNeedsReauthorisation", () => {
	it.each([
		["a linked Google identity and no refresh token", "g-1", null, true],
		["a linked Google identity and an empty refresh token", "g-1", "", true],
		["a linked Google identity and a refresh token", "g-1", "r-1", false],
		["no Google identity and no refresh token", null, null, false],
		["an empty Google identity and no refresh token", "", null, false],
		["no Google identity but a leftover refresh token", null, "r-1", false],
		["an empty Google identity and a refresh token", "", "r-1", false],
	])("for %s answers %s", (_label, googleId, googleRefreshToken, expected) => {
		expect(googleNeedsReauthorisation({ googleId, googleRefreshToken })).toBe(
			expected
		);
	});
});
