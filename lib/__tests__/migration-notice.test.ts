import { describe, expect, it } from "vitest";
import { isEmailMissing, isMigrationNoticeDue } from "@/lib/migration-notice";

describe("isEmailMissing", () => {
	it.each([
		["undefined", undefined],
		["null", null],
		["an empty string", ""],
		["a placeholder address", "someone@placeholder.invalid"],
		["a placeholder host in the middle", "a@placeholder"],
	])("is true for %s", (_label, email) => {
		expect(isEmailMissing(email)).toBe(true);
	});

	it.each([
		["an ordinary address", "someone@example.org"],
		["a single character", "x"],
		[
			"the word placeholder before the at sign",
			"placeholder.person@example.org",
		],
	])("is false for %s", (_label, email) => {
		expect(isEmailMissing(email)).toBe(false);
	});
});

describe("isMigrationNoticeDue", () => {
	const usable = "someone@example.org";
	const placeholder = "someone@placeholder.invalid";

	it.each([
		[
			"usable email, notice seen",
			{ email: usable, hasSeenMigrationNotice: true },
			false,
		],
		[
			"usable email, notice not seen",
			{ email: usable, hasSeenMigrationNotice: false },
			true,
		],
		["usable email, seen flag absent", { email: usable }, true],
		[
			"placeholder email, notice seen",
			{ email: placeholder, hasSeenMigrationNotice: true },
			true,
		],
		[
			"placeholder email, notice not seen",
			{ email: placeholder, hasSeenMigrationNotice: false },
			true,
		],
		[
			"null email, notice seen",
			{ email: null, hasSeenMigrationNotice: true },
			true,
		],
		[
			"null email, notice not seen",
			{ email: null, hasSeenMigrationNotice: false },
			true,
		],
		["email absent, notice seen", { hasSeenMigrationNotice: true }, true],
		[
			"empty email, notice seen",
			{ email: "", hasSeenMigrationNotice: true },
			true,
		],
		["no fields at all", {}, true],
	])("%s", (_label, user, expected) => {
		expect(isMigrationNoticeDue(user)).toBe(expected);
	});
});
