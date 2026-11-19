import { describe, expect, it } from "vitest";
import { signInFormSchema } from "@/lib/schemas/user";
import {
	DOTTED_CAPITAL_I,
	NO_BREAK_SPACE,
	TRIMMED_WHITESPACE,
} from "@/src/__tests__/helpers/identifier-characters";
import { normaliseSignInIdentifier } from "../sign-in-identifier";

describe("normaliseSignInIdentifier: edge cases", () => {
	it.each(TRIMMED_WHITESPACE)("removes %s from both ends", (_label, space) => {
		expect(normaliseSignInIdentifier(`${space}${space}demo${space}`)).toBe(
			"demo"
		);
	});

	it.each(
		TRIMMED_WHITESPACE
	)("returns null when the value is only %s", (_label, space) => {
		expect(normaliseSignInIdentifier(`${space}${space}`)).toBeNull();
	});

	it("leaves whitespace inside the value alone", () => {
		expect(normaliseSignInIdentifier(` a\tb${NO_BREAK_SPACE}c `)).toBe(
			`a\tb${NO_BREAK_SPACE}c`
		);
	});

	it("does not change capitals or non-ASCII characters", () => {
		const typed = `${DOTTED_CAPITAL_I}Nfo@Example.COM`;

		expect(normaliseSignInIdentifier(` ${typed} `)).toBe(typed);
	});

	it("gives the same result when applied twice", () => {
		const once = normaliseSignInIdentifier("\t Demo \n");

		expect(normaliseSignInIdentifier(once)).toBe(once);
	});

	it.each([
		[" demo "],
		["\tDemo@Example.com\n"],
		[`${NO_BREAK_SPACE}demo${NO_BREAK_SPACE}`],
		["a b"],
	])("agrees with the sign-in form's trimmed identifier", (typed) => {
		const parsed = signInFormSchema.safeParse({
			identifier: typed,
			password: "Passw0rd!Passw0rd",
		});

		expect(parsed.success).toBe(true);
		expect(normaliseSignInIdentifier(typed)).toBe(parsed.data?.identifier);
	});
});
