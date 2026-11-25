import { describe, expect, it } from "vitest";
import type { z } from "zod";
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

const REJECTED = Symbol("rejected");
const URL_MESSAGE = "Enter a web address, such as example.com/report.pdf";

/** The parsed value, or REJECTED when the input does not pass. */
function parsed(schema: z.ZodType, input: unknown): unknown {
	const result = schema.safeParse(input);
	return result.success ? result.data : REJECTED;
}

/** Every message the schema reports for the input (empty when it passes). */
function messages(schema: z.ZodType, input: unknown): string[] {
	const result = schema.safeParse(input);
	return result.success ? [] : result.error.issues.map((i) => i.message);
}

/** An email address of exactly `length` characters. */
function emailOfLength(length: number): string {
	const lastLabel = length - 65 - 128;
	return `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(lastLabel)}`;
}

describe("emailSchema", () => {
	it("lowercases a valid address", () => {
		expect(parsed(emailSchema, "User@Example.COM")).toBe("user@example.com");
	});

	it("asks for an address when the field is empty", () => {
		expect(messages(emailSchema, "")).toContain("Email is required");
	});

	it("rejects text that is not an address, with the format message", () => {
		expect(messages(emailSchema, "not-an-email")).toEqual([
			"Please enter a valid email address",
		]);
	});

	it("accepts an address of 254 characters", () => {
		expect(emailOfLength(254)).toHaveLength(254);
		expect(parsed(emailSchema, emailOfLength(254))).toBe(emailOfLength(254));
	});

	it("rejects an address of 255 characters, with the length message", () => {
		expect(emailOfLength(255)).toHaveLength(255);
		expect(messages(emailSchema, emailOfLength(255))).toEqual([
			"Email must be less than 254 characters",
		]);
	});
});

describe("uuidSchema", () => {
	it("accepts a UUID", () => {
		const id = "123e4567-e89b-42d3-a456-426614174000";
		expect(parsed(uuidSchema, id)).toBe(id);
	});

	it("rejects other text with the ID message", () => {
		expect(messages(uuidSchema, "not-a-uuid")).toEqual(["Invalid ID format"]);
	});
});

describe("requiredString", () => {
	it("trims the value and accepts it", () => {
		expect(parsed(requiredString("Name"), "  Ada ")).toBe("Ada");
	});

	it("names the field when the value is empty", () => {
		expect(messages(requiredString("Name"), "")).toEqual(["Name is required"]);
	});

	it("allows 500 characters by default and rejects 501 with the limit in the message", () => {
		expect(parsed(requiredString("Name"), "a".repeat(500))).toBe(
			"a".repeat(500)
		);
		expect(messages(requiredString("Name"), "a".repeat(501))).toEqual([
			"Name must be less than 500 characters",
		]);
	});

	it("applies a custom minimum and maximum to the trimmed value", () => {
		const schema = requiredString("Code", 3, 5);
		expect(messages(schema, " ab ")).toEqual(["Code is required"]);
		expect(parsed(schema, " abc ")).toBe("abc");
		expect(parsed(schema, "abcde")).toBe("abcde");
		expect(messages(schema, "abcdef")).toEqual([
			"Code must be less than 5 characters",
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
		expect(parsed(optionalString(), input)).toBe(expected);
	});

	it("allows 2000 characters by default and rejects 2001", () => {
		expect(parsed(optionalString(), "a".repeat(2000))).toBe("a".repeat(2000));
		expect(messages(optionalString(), "a".repeat(2001))).toEqual([
			"Must be less than 2000 characters",
		]);
	});

	it("uses a custom limit in the check and in the message", () => {
		expect(parsed(optionalString(5), "abcde")).toBe("abcde");
		expect(messages(optionalString(5), "abcdef")).toEqual([
			"Must be less than 5 characters",
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
		expect(parsed(clearableString(), input)).toBe(expected);
	});

	it("uses a custom limit in the check and in the message", () => {
		expect(parsed(clearableString(5), "abcde")).toBe("abcde");
		expect(messages(clearableString(5), "abcdef")).toEqual([
			"Must be less than 5 characters",
		]);
	});

	it("allows 2000 characters by default and rejects 2001", () => {
		expect(parsed(clearableString(), "a".repeat(2000))).toBe("a".repeat(2000));
		expect(messages(clearableString(), "a".repeat(2001))).toEqual([
			"Must be less than 2000 characters",
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
		expect(parsed(optionalStringAllowingEmpty(), input)).toBe(expected);
	});

	it("uses a custom limit in the check and in the message", () => {
		expect(parsed(optionalStringAllowingEmpty(5), "abcde")).toBe("abcde");
		expect(messages(optionalStringAllowingEmpty(5), "abcdef")).toEqual([
			"Must be less than 5 characters",
		]);
	});

	it("allows 2000 characters by default and rejects 2001", () => {
		expect(parsed(optionalStringAllowingEmpty(), "a".repeat(2000))).toBe(
			"a".repeat(2000)
		);
		expect(messages(optionalStringAllowingEmpty(), "a".repeat(2001))).toEqual([
			"Must be less than 2000 characters",
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
		expect(parsed(placeholderHintInputSchema, input)).toBe(expected);
	});

	it("allows 500 characters and rejects 501 with the hint message", () => {
		expect(parsed(placeholderHintInputSchema, "a".repeat(500))).toBe(
			"a".repeat(500)
		);
		expect(messages(placeholderHintInputSchema, "a".repeat(501))).toEqual([
			"A hint must be 500 characters or fewer",
		]);
	});
});

describe("usernameSchema", () => {
	it.each(["abc", "a-b_C1", "a".repeat(50)])("accepts %s", (name) => {
		expect(parsed(usernameSchema, name)).toBe(name);
	});

	it("rejects two characters with the minimum message", () => {
		expect(messages(usernameSchema, "ab")).toEqual([
			"Username must be at least 3 characters",
		]);
	});

	it("rejects 51 characters with the maximum message", () => {
		expect(messages(usernameSchema, "a".repeat(51))).toEqual([
			"Username must be at most 50 characters",
		]);
	});

	it.each([
		"ab cd",
		"!abc",
		"abc!",
		"a.bc",
		"ab\ncd",
	])("rejects %j with the allowed-characters message", (name) => {
		expect(messages(usernameSchema, name)).toEqual([
			"Username can only contain letters, numbers, underscores, and hyphens",
		]);
	});
});

describe("stringIdSchema", () => {
	it("trims the value", () => {
		expect(parsed(stringIdSchema, "  tour-1 ")).toBe("tour-1");
	});

	it("accepts a short and a 100-character identifier", () => {
		expect(parsed(stringIdSchema, "abc")).toBe("abc");
		expect(parsed(stringIdSchema, "a".repeat(100))).toBe("a".repeat(100));
	});

	it("rejects an empty identifier with the required message", () => {
		expect(messages(stringIdSchema, "")).toEqual(["ID is required"]);
	});

	it("rejects 101 characters with the length message", () => {
		expect(messages(stringIdSchema, "a".repeat(101))).toEqual([
			"ID must be less than 100 characters",
		]);
	});
});

describe("lenientUrlSchema scheme detection", () => {
	it("adds https:// to an address whose later text contains a scheme", () => {
		expect(parsed(lenientUrlSchema, "example.com/go?next=http://a.com")).toBe(
			"https://example.com/go?next=http://a.com"
		);
	});

	it("adds https:// to an address with a colon after the host", () => {
		expect(parsed(lenientUrlSchema, "example.com/a:b")).toBe(
			"https://example.com/a:b"
		);
	});

	it("rejects a scheme that holds a digit and is not http(s)", () => {
		expect(messages(lenientUrlSchema, "ftp2://example.com")).toEqual([
			URL_MESSAGE,
		]);
	});

	it("rejects a scheme with a digit and no slashes", () => {
		expect(messages(lenientUrlSchema, "x2:80")).toEqual([URL_MESSAGE]);
	});

	it("rejects a non-http scheme even when the rest of the address contains https://", () => {
		expect(
			messages(lenientUrlSchema, "ftp://example.com/?next=https://a.com")
		).toEqual([URL_MESSAGE]);
	});
});

describe("optionalUrlSchema", () => {
	it("keeps an absent value absent", () => {
		expect(parsed(optionalUrlSchema, undefined)).toBeUndefined();
	});

	it("normalises a padded address", () => {
		expect(parsed(optionalUrlSchema, " example.com ")).toBe(
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
		expect(parsed(nullableUrlSchema, input)).toBeNull();
	});

	it("keeps an absent value absent", () => {
		expect(parsed(nullableUrlSchema, undefined)).toBeUndefined();
	});

	it("normalises a bare domain", () => {
		expect(parsed(nullableUrlSchema, " example.com ")).toBe(
			"https://example.com"
		);
	});

	it("reports the web address message for a mailto: address", () => {
		expect(messages(nullableUrlSchema, "mailto:a@b.co")).toEqual([URL_MESSAGE]);
	});

	// Reads the raw issue list: the issue code is not visible any other way.
	it("reports a custom issue for an invalid address", () => {
		const result = nullableUrlSchema.safeParse("mailto:a@b.co");
		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.code).toBe("custom");
	});
});

describe("positiveIntSchema and coercePositiveInt", () => {
	it.each([
		["a fraction", 1.5, "Must be a whole number"],
		["zero", 0, "Must be a positive number"],
		["a negative number", -3, "Must be a positive number"],
	])("rejects %s", (_name, input, message) => {
		expect(messages(positiveIntSchema, input)).toEqual([message]);
		expect(messages(coercePositiveInt, input)).toEqual([message]);
	});

	it("accepts a positive whole number", () => {
		expect(parsed(positiveIntSchema, 7)).toBe(7);
	});

	it("turns text into a number before checking it", () => {
		expect(parsed(coercePositiveInt, "7")).toBe(7);
		expect(messages(coercePositiveInt, "1.5")).toEqual([
			"Must be a whole number",
		]);
		expect(messages(coercePositiveInt, "0")).toEqual([
			"Must be a positive number",
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
		expect(parsed(coerceBoolean, input)).toBe(expected);
	});
});

describe("permissionLevelSchema", () => {
	it.each(["VIEW", "COMMENT", "EDIT", "ADMIN"])("accepts %s", (level) => {
		expect(parsed(permissionLevelSchema, level)).toBe(level);
	});

	it.each(["OWNER", "", "view"])("rejects %j with the level message", (v) => {
		expect(messages(permissionLevelSchema, v)).toEqual([
			"Invalid permission level",
		]);
	});
});

describe("teamRoleSchema", () => {
	it.each(["ADMIN", "MEMBER"])("accepts %s", (role) => {
		expect(parsed(teamRoleSchema, role)).toBe(role);
	});

	it.each(["OWNER", "", "member"])("rejects %j with the role message", (v) => {
		expect(messages(teamRoleSchema, v)).toEqual(["Invalid team role"]);
	});
});
