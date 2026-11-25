import { describe, expect, it } from "vitest";
import {
	emailOfLength,
	issuesOf,
	outputOf,
} from "@/src/__tests__/utils/schema-issues-kit";
import {
	clearableString,
	coerceBoolean,
	coercePositiveInt,
	emailSchema,
	lenientUrlSchema,
	nullableUrlSchema,
	optionalString,
	optionalStringAllowingEmpty,
	optionalUrlSchema,
	permissionLevelSchema,
	placeholderHintInputSchema,
	positiveIntSchema,
	requiredString,
	stringIdSchema,
	teamRoleSchema,
	usernameSchema,
	uuidSchema,
} from "../base";

const URL_MESSAGE = ": Enter a web address, such as example.com/report.pdf";

describe("emailSchema", () => {
	it("lowercases a valid address", () => {
		expect(outputOf(emailSchema, "User@Example.COM")).toBe("user@example.com");
	});

	it("asks for an address when the field is empty", () => {
		expect(issuesOf(emailSchema, "")).toContain(": Email is required");
	});

	it("rejects text that is not an address, with the format message", () => {
		expect(issuesOf(emailSchema, "not-an-email")).toEqual([
			": Please enter a valid email address",
		]);
	});

	it("accepts an address of 254 characters", () => {
		expect(emailOfLength(254)).toHaveLength(254);
		expect(outputOf(emailSchema, emailOfLength(254))).toBe(emailOfLength(254));
	});

	it("rejects an address of 255 characters, with the length message", () => {
		expect(emailOfLength(255)).toHaveLength(255);
		expect(issuesOf(emailSchema, emailOfLength(255))).toEqual([
			": Email must be less than 254 characters",
		]);
	});
});

describe("uuidSchema", () => {
	it("accepts a UUID", () => {
		const id = "123e4567-e89b-42d3-a456-426614174000";
		expect(outputOf(uuidSchema, id)).toBe(id);
	});

	it("rejects other text with the ID message", () => {
		expect(issuesOf(uuidSchema, "not-a-uuid")).toEqual([": Invalid ID format"]);
	});
});

describe("requiredString", () => {
	it("trims the value and accepts it", () => {
		expect(outputOf(requiredString("Name"), "  Ada ")).toBe("Ada");
	});

	it("names the field when the value is empty", () => {
		expect(issuesOf(requiredString("Name"), "")).toEqual([
			": Name is required",
		]);
	});

	it("allows 500 characters by default and rejects 501 with the limit in the message", () => {
		expect(outputOf(requiredString("Name"), "a".repeat(500))).toBe(
			"a".repeat(500)
		);
		expect(issuesOf(requiredString("Name"), "a".repeat(501))).toEqual([
			": Name must be less than 500 characters",
		]);
	});

	it("applies a custom minimum and maximum to the trimmed value", () => {
		const schema = requiredString("Code", 3, 5);
		expect(issuesOf(schema, " ab ")).toEqual([": Code is required"]);
		expect(outputOf(schema, " abc ")).toBe("abc");
		expect(outputOf(schema, "abcde")).toBe("abcde");
		expect(issuesOf(schema, "abcdef")).toEqual([
			": Code must be less than 5 characters",
		]);
	});
});

describe("optionalString", () => {
	it.each([
		["padded text is trimmed", "  hi ", "hi"],
		["an empty string becomes undefined", "", undefined],
		["spaces become undefined", "   ", undefined],
		["null becomes undefined", null, undefined],
		["an absent value stays undefined", undefined, undefined],
	])("%s", (_name, input, expected) => {
		expect(outputOf(optionalString(), input)).toBe(expected);
	});

	it("allows 2000 characters by default and rejects 2001", () => {
		expect(outputOf(optionalString(), "a".repeat(2000))).toBe("a".repeat(2000));
		expect(issuesOf(optionalString(), "a".repeat(2001))).toEqual([
			": Must be less than 2000 characters",
		]);
	});

	it("uses a custom limit in the check and in the message", () => {
		expect(outputOf(optionalString(5), "abcde")).toBe("abcde");
		expect(issuesOf(optionalString(5), "abcdef")).toEqual([
			": Must be less than 5 characters",
		]);
	});
});

describe("clearableString", () => {
	it.each([
		["padded text is trimmed", "  hi ", "hi"],
		["an empty string clears", "", null],
		["spaces clear", "   ", null],
		["null clears", null, null],
		["an absent value stays undefined", undefined, undefined],
	])("%s", (_name, input, expected) => {
		expect(outputOf(clearableString(), input)).toBe(expected);
	});

	it("uses a custom limit in the check and in the message", () => {
		expect(outputOf(clearableString(5), "abcde")).toBe("abcde");
		expect(issuesOf(clearableString(5), "abcdef")).toEqual([
			": Must be less than 5 characters",
		]);
	});

	it("allows 2000 characters by default and rejects 2001", () => {
		expect(outputOf(clearableString(), "a".repeat(2000))).toBe(
			"a".repeat(2000)
		);
		expect(issuesOf(clearableString(), "a".repeat(2001))).toEqual([
			": Must be less than 2000 characters",
		]);
	});
});

describe("optionalStringAllowingEmpty", () => {
	it.each([
		["padded text is trimmed", "  hi ", "hi"],
		["an empty string is kept", "", ""],
		["spaces become undefined", "   ", undefined],
		["null becomes undefined", null, undefined],
		["an absent value stays undefined", undefined, undefined],
	])("%s", (_name, input, expected) => {
		expect(outputOf(optionalStringAllowingEmpty(), input)).toBe(expected);
	});

	it("uses a custom limit in the check and in the message", () => {
		expect(outputOf(optionalStringAllowingEmpty(5), "abcde")).toBe("abcde");
		expect(issuesOf(optionalStringAllowingEmpty(5), "abcdef")).toEqual([
			": Must be less than 5 characters",
		]);
	});

	it("allows 2000 characters by default and rejects 2001", () => {
		expect(outputOf(optionalStringAllowingEmpty(), "a".repeat(2000))).toBe(
			"a".repeat(2000)
		);
		expect(issuesOf(optionalStringAllowingEmpty(), "a".repeat(2001))).toEqual([
			": Must be less than 2000 characters",
		]);
	});
});

describe("placeholderHintInputSchema", () => {
	it.each([
		["padded text is trimmed", "  hint ", "hint"],
		["an empty string clears", "", null],
		["spaces clear", "   ", null],
		["null clears", null, null],
		["an absent value stays undefined", undefined, undefined],
	])("%s", (_name, input, expected) => {
		expect(outputOf(placeholderHintInputSchema, input)).toBe(expected);
	});

	it("allows 500 characters and rejects 501 with the hint message", () => {
		expect(outputOf(placeholderHintInputSchema, "a".repeat(500))).toBe(
			"a".repeat(500)
		);
		expect(issuesOf(placeholderHintInputSchema, "a".repeat(501))).toEqual([
			": A hint must be 500 characters or fewer",
		]);
	});
});

describe("usernameSchema", () => {
	it.each(["abc", "a-b_C1", "a".repeat(50)])("accepts %s", (name) => {
		expect(outputOf(usernameSchema, name)).toBe(name);
	});

	it("rejects two characters with the minimum message", () => {
		expect(issuesOf(usernameSchema, "ab")).toEqual([
			": Username must be at least 3 characters",
		]);
	});

	it("rejects 51 characters with the maximum message", () => {
		expect(issuesOf(usernameSchema, "a".repeat(51))).toEqual([
			": Username must be at most 50 characters",
		]);
	});

	it.each([
		"ab cd",
		"!abc",
		"abc!",
		"a.bc",
		"ab\ncd",
	])("rejects %j with the allowed-characters message", (name) => {
		expect(issuesOf(usernameSchema, name)).toEqual([
			": Username can only contain letters, numbers, underscores, and hyphens",
		]);
	});
});

describe("stringIdSchema", () => {
	it("trims the value", () => {
		expect(outputOf(stringIdSchema, "  tour-1 ")).toBe("tour-1");
	});

	it("accepts a short and a 100-character identifier", () => {
		expect(outputOf(stringIdSchema, "abc")).toBe("abc");
		expect(outputOf(stringIdSchema, "a".repeat(100))).toBe("a".repeat(100));
	});

	it("rejects an empty identifier with the required message", () => {
		expect(issuesOf(stringIdSchema, "")).toEqual([": ID is required"]);
	});

	it("rejects 101 characters with the length message", () => {
		expect(issuesOf(stringIdSchema, "a".repeat(101))).toEqual([
			": ID must be less than 100 characters",
		]);
	});
});

describe("lenientUrlSchema scheme detection", () => {
	it("adds https:// to an address whose later text contains a scheme", () => {
		expect(outputOf(lenientUrlSchema, "example.com/go?next=http://a.com")).toBe(
			"https://example.com/go?next=http://a.com"
		);
	});

	it("adds https:// to an address with a colon after the host", () => {
		expect(outputOf(lenientUrlSchema, "example.com/a:b")).toBe(
			"https://example.com/a:b"
		);
	});

	it("rejects a scheme that holds a digit and is not http(s)", () => {
		expect(issuesOf(lenientUrlSchema, "ftp2://example.com")).toEqual([
			URL_MESSAGE,
		]);
	});

	it("rejects a scheme with a digit and no slashes", () => {
		expect(issuesOf(lenientUrlSchema, "x2:80")).toEqual([URL_MESSAGE]);
	});

	it("rejects a non-http scheme even when the rest of the address contains https://", () => {
		expect(
			issuesOf(lenientUrlSchema, "ftp://example.com/?next=https://a.com")
		).toEqual([URL_MESSAGE]);
	});
});

describe("optionalUrlSchema", () => {
	it("keeps an absent value absent", () => {
		expect(outputOf(optionalUrlSchema, undefined)).toBeUndefined();
	});

	it("normalises a padded address", () => {
		expect(outputOf(optionalUrlSchema, " example.com ")).toBe(
			"https://example.com"
		);
	});
});

describe("nullableUrlSchema", () => {
	it.each([
		["null", null],
		["an empty string", ""],
		["spaces", "   "],
	])("turns %s into null", (_name, input) => {
		expect(outputOf(nullableUrlSchema, input)).toBeNull();
	});

	it("keeps an absent value absent", () => {
		expect(outputOf(nullableUrlSchema, undefined)).toBeUndefined();
	});

	it("normalises a bare domain", () => {
		expect(outputOf(nullableUrlSchema, " example.com ")).toBe(
			"https://example.com"
		);
	});

	it("reports the web address message for a mailto: address", () => {
		expect(issuesOf(nullableUrlSchema, "mailto:a@b.co")).toEqual([URL_MESSAGE]);
	});
});

describe("positiveIntSchema and coercePositiveInt", () => {
	it.each([
		["a fraction", 1.5, ": Must be a whole number"],
		["zero", 0, ": Must be a positive number"],
		["a negative number", -3, ": Must be a positive number"],
	])("rejects %s", (_name, input, message) => {
		expect(issuesOf(positiveIntSchema, input)).toEqual([message]);
		expect(issuesOf(coercePositiveInt, input)).toEqual([message]);
	});

	it("accepts a positive whole number", () => {
		expect(outputOf(positiveIntSchema, 7)).toBe(7);
	});

	it("turns text into a number before checking it", () => {
		expect(outputOf(coercePositiveInt, "7")).toBe(7);
		expect(issuesOf(coercePositiveInt, "1.5")).toEqual([
			": Must be a whole number",
		]);
		expect(issuesOf(coercePositiveInt, "0")).toEqual([
			": Must be a positive number",
		]);
	});
});

describe("coerceBoolean", () => {
	it.each([
		["the text true", "true", true],
		["the text false", "false", false],
		["other text", "yes", false],
		["null", null, false],
		["an absent value", undefined, false],
	])("reads %s", (_name, input, expected) => {
		expect(outputOf(coerceBoolean, input)).toBe(expected);
	});
});

describe("permissionLevelSchema", () => {
	it.each(["VIEW", "COMMENT", "EDIT", "ADMIN"])("accepts %s", (level) => {
		expect(outputOf(permissionLevelSchema, level)).toBe(level);
	});

	it.each(["OWNER", "", "view"])("rejects %j with the level message", (v) => {
		expect(issuesOf(permissionLevelSchema, v)).toEqual([
			": Invalid permission level",
		]);
	});
});

describe("teamRoleSchema", () => {
	it.each(["ADMIN", "MEMBER"])("accepts %s", (role) => {
		expect(outputOf(teamRoleSchema, role)).toBe(role);
	});

	it.each(["OWNER", "", "member"])("rejects %j with the role message", (v) => {
		expect(issuesOf(teamRoleSchema, v)).toEqual([": Invalid team role"]);
	});
});
