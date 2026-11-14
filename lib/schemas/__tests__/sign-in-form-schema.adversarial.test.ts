import { describe, expect, it } from "vitest";
import {
	NO_BREAK_SPACE,
	TRIMMED_WHITESPACE,
} from "@/src/__tests__/helpers/identifier-characters";
import { signInFormSchema } from "../user";

const PASSWORD = "Passw0rd!Passw0rd";
const IDENTIFIER_MESSAGE = "Please enter your email or username";

function identifierResult(identifier: string) {
	return signInFormSchema.safeParse({ identifier, password: PASSWORD });
}

function passwordResult(password: string) {
	return signInFormSchema.safeParse({ identifier: "demo", password });
}

describe("signInFormSchema: identifier edge cases", () => {
	it.each(TRIMMED_WHITESPACE)("trims %s from both ends", (_label, space) => {
		expect(identifierResult(`${space}demo${space}`).data?.identifier).toBe(
			"demo"
		);
	});

	it("keeps capitals, inner spaces and an email's characters", () => {
		expect(
			identifierResult(" Demo.Name+tag@Example.com ").data?.identifier
		).toBe("Demo.Name+tag@Example.com");
		expect(identifierResult("Demo Name").data?.identifier).toBe("Demo Name");
	});

	it.each([
		["an empty value", ""],
		["spaces only", "   "],
		["a tab and a line feed", "\t\n"],
		["no-break spaces only", NO_BREAK_SPACE + NO_BREAK_SPACE],
		["one character between spaces", " a "],
		["one character", "a"],
	])("refuses %s with the identifier message once it is trimmed", (_label, typed) => {
		const result = identifierResult(typed);

		expect(result.success).toBe(false);
		expect(result.error?.issues[0]).toMatchObject({
			path: ["identifier"],
			message: IDENTIFIER_MESSAGE,
		});
	});

	it("accepts a two-character identifier padded with spaces", () => {
		expect(identifierResult(" ab ").data?.identifier).toBe("ab");
	});
});

describe("signInFormSchema: the password is not trimmed", () => {
	it.each([
		["spaces around four characters", "  1234  "],
		["one trailing space", "1234567 "],
		["eight tabs", "\t".repeat(8)],
	])("keeps %s as typed", (_label, typed) => {
		expect(passwordResult(typed).data?.password).toBe(typed);
	});

	it("still counts the spaces towards the eight-character minimum", () => {
		expect(passwordResult("1234567").success).toBe(false);
		expect(passwordResult("1234567 ").success).toBe(true);
	});
});
