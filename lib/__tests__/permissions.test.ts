import { describe, expect, it } from "vitest";
import {
	hasPermissionLevel,
	hasTeamRole,
	maxPermission,
} from "@/lib/permissions";

type Level = "VIEW" | "COMMENT" | "EDIT" | "ADMIN";
type Role = "MEMBER" | "ADMIN" | "OWNER";

/** Each case level, with the required levels it meets (written out in full). */
const LEVEL_PAIRS: [Level, Level, boolean][] = [
	["VIEW", "VIEW", true],
	["VIEW", "COMMENT", false],
	["VIEW", "EDIT", false],
	["VIEW", "ADMIN", false],
	["COMMENT", "VIEW", true],
	["COMMENT", "COMMENT", true],
	["COMMENT", "EDIT", false],
	["COMMENT", "ADMIN", false],
	["EDIT", "VIEW", true],
	["EDIT", "COMMENT", true],
	["EDIT", "EDIT", true],
	["EDIT", "ADMIN", false],
	["ADMIN", "VIEW", true],
	["ADMIN", "COMMENT", true],
	["ADMIN", "EDIT", true],
	["ADMIN", "ADMIN", true],
];

const ROLE_PAIRS: [Role, Role, boolean][] = [
	["MEMBER", "MEMBER", true],
	["MEMBER", "ADMIN", false],
	["MEMBER", "OWNER", false],
	["ADMIN", "MEMBER", true],
	["ADMIN", "ADMIN", true],
	["ADMIN", "OWNER", false],
	["OWNER", "MEMBER", true],
	["OWNER", "ADMIN", true],
	["OWNER", "OWNER", true],
];

/** First level, second level, the higher of the two. */
const MAX_PAIRS: [Level, Level, Level][] = [
	["VIEW", "VIEW", "VIEW"],
	["VIEW", "COMMENT", "COMMENT"],
	["VIEW", "EDIT", "EDIT"],
	["VIEW", "ADMIN", "ADMIN"],
	["COMMENT", "VIEW", "COMMENT"],
	["COMMENT", "COMMENT", "COMMENT"],
	["COMMENT", "EDIT", "EDIT"],
	["COMMENT", "ADMIN", "ADMIN"],
	["EDIT", "VIEW", "EDIT"],
	["EDIT", "COMMENT", "EDIT"],
	["EDIT", "EDIT", "EDIT"],
	["EDIT", "ADMIN", "ADMIN"],
	["ADMIN", "VIEW", "ADMIN"],
	["ADMIN", "COMMENT", "ADMIN"],
	["ADMIN", "EDIT", "ADMIN"],
	["ADMIN", "ADMIN", "ADMIN"],
];

describe("hasPermissionLevel", () => {
	it.each(
		LEVEL_PAIRS
	)("held %s, required %s: %s", (held, required, expected) => {
		expect(hasPermissionLevel(held, required)).toBe(expected);
	});
});

describe("hasTeamRole", () => {
	it.each(
		ROLE_PAIRS
	)("held %s, required %s: %s", (held, required, expected) => {
		expect(hasTeamRole(held, required)).toBe(expected);
	});
});

describe("maxPermission", () => {
	it.each(MAX_PAIRS)("%s and %s give %s", (a, b, expected) => {
		expect(maxPermission(a, b)).toBe(expected);
	});

	it("gives null when both are missing", () => {
		expect(maxPermission(null, null)).toBeNull();
	});

	it.each([
		"VIEW",
		"COMMENT",
		"EDIT",
		"ADMIN",
	] as const)("gives %s when the other is missing, in either order", (level) => {
		expect(maxPermission(level, null)).toBe(level);
		expect(maxPermission(null, level)).toBe(level);
	});
});
