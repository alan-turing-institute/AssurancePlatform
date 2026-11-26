import { describe, expect, it } from "vitest";
import { registerUserSchema } from "../user";

const PASSWORD = "StrongP@ss1";
const OTHER = "OtherP@ss2";
const MISMATCH = "Passwords do not match";
const REQUIRED = "Password is required";

const identity = { username: "signup_user", email: "signup@example.com" };

function parse(fields: Record<string, unknown>) {
	return registerUserSchema.safeParse({ ...identity, ...fields });
}

function issuesOf(fields: Record<string, unknown>) {
	const result = parse(fields);
	return result.success
		? []
		: result.error.issues.map((i) => ({
				message: i.message,
				path: i.path.join("."),
			}));
}

const mismatchOnConfirmation = [{ message: MISMATCH, path: "password2" }];

describe("registerUserSchema confirmation compared with the password in use", () => {
	it("refuses a differing confirmation when the password is in `password`", () => {
		expect(issuesOf({ password: PASSWORD, password2: OTHER })).toEqual(
			mismatchOnConfirmation
		);
	});

	it("refuses a differing confirmation when the password is in `password1`", () => {
		expect(issuesOf({ password1: PASSWORD, password2: OTHER })).toEqual(
			mismatchOnConfirmation
		);
	});

	it("refuses an empty confirmation beside a password", () => {
		expect(issuesOf({ password: PASSWORD, password2: "" })).toEqual(
			mismatchOnConfirmation
		);
		expect(issuesOf({ password1: PASSWORD, password2: "" })).toEqual(
			mismatchOnConfirmation
		);
	});

	it.each([
		["case", PASSWORD.toLowerCase()],
		["trailing space", `${PASSWORD} `],
		["leading space", ` ${PASSWORD}`],
	])("refuses a confirmation that differs only in %s", (_name, confirmation) => {
		expect(issuesOf({ password: PASSWORD, password2: confirmation })).toEqual(
			mismatchOnConfirmation
		);
	});

	it("refuses a confirmation that is the same text in another Unicode form", () => {
		const composed = "CaféP@ss1";
		const decomposed = "CaféP@ss1";
		expect(composed).not.toBe(decomposed);

		expect(issuesOf({ password: composed, password2: decomposed })).toEqual(
			mismatchOnConfirmation
		);
	});
});

describe("registerUserSchema when both password fields are sent", () => {
	it("accepts a confirmation equal to `password` and uses `password`", () => {
		const result = parse({
			password: PASSWORD,
			password1: OTHER,
			password2: PASSWORD,
		});

		expect(result.success).toBe(true);
		expect(result.data?.password).toBe(PASSWORD);
	});

	it("refuses a confirmation equal only to `password1`", () => {
		expect(
			issuesOf({ password: PASSWORD, password1: OTHER, password2: OTHER })
		).toEqual(mismatchOnConfirmation);
	});

	it("accepts equal fields with an equal confirmation", () => {
		expect(
			parse({ password: PASSWORD, password1: PASSWORD, password2: PASSWORD })
				.success
		).toBe(true);
	});
});

describe("registerUserSchema without a password", () => {
	it.each([
		["a differing confirmation", { password2: OTHER }],
		["an empty confirmation", { password2: "" }],
		["no confirmation", {}],
	])("reports only the missing password with %s", (_name, fields) => {
		expect(issuesOf(fields)).toEqual([{ message: REQUIRED, path: "password" }]);
	});
});

describe("registerUserSchema accepts what it accepted before", () => {
	it.each([
		["password alone", { password: PASSWORD }],
		["password1 alone", { password1: PASSWORD }],
		[
			"password with an equal confirmation",
			{ password: PASSWORD, password2: PASSWORD },
		],
		[
			"password1 with an equal confirmation",
			{ password1: PASSWORD, password2: PASSWORD },
		],
		[
			"a confirmation set to undefined",
			{ password: PASSWORD, password2: undefined },
		],
	])("%s", (_name, fields) => {
		expect(parse(fields).success).toBe(true);
	});
});

describe("registerUserSchema still refuses malformed input", () => {
	it.each([
		["null", null],
		["a number", 12_345_678],
		["an object", { value: PASSWORD }],
	])("refuses a confirmation that is %s", (_name, confirmation) => {
		expect(parse({ password: PASSWORD, password2: confirmation }).success).toBe(
			false
		);
	});

	it("refuses an unknown field beside a matching confirmation", () => {
		expect(
			parse({ password: PASSWORD, password2: PASSWORD, extra: "x" }).success
		).toBe(false);
	});
});
