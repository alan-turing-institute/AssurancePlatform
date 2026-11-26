import { describe, expect, it } from "vitest";
import { issuesOf, outputOf } from "@/src/__tests__/utils/schema-issues-kit";
import {
	changePasswordFormSchema,
	deleteAccountSchema,
	forgotPasswordFormSchema,
	passwordSchema,
	personalInfoFormSchema,
	registerFormSchema,
	registerUserSchema,
	resetPasswordFormSchema,
	signInFormSchema,
	updateUserProfileSchema,
} from "../user";

const STRONG = "Abcdef1!";
const TOO_SHORT = "Password must be at least 8 characters";
const NO_UPPER = "Password must contain at least one uppercase letter";
const NO_DIGIT = "Password must contain at least one number";
const NO_SPECIAL = "Password must contain at least one special character";
const MISMATCH = "Passwords do not match";
const SPECIALS = Array.from("!@#$%^&*()_+-=[]{};':\"\\|,.<>/?~`");

describe("passwordSchema", () => {
	it.each([
		["exactly eight characters", "Abcde1!x"],
		["a long password", `${STRONG}${"x".repeat(100)}`],
	])("accepts %s", (_name, password) => {
		expect(issuesOf(passwordSchema, password)).toEqual([]);
	});

	it.each([
		["seven characters", "Abcd1!x", TOO_SHORT],
		["no capital letter", "abcde1!x", NO_UPPER],
		["no digit", "Abcdef!x", NO_DIGIT],
		["no special character", "Abcdef1x", NO_SPECIAL],
	])("refuses %s with only its own message", (_name, password, message) => {
		expect(issuesOf(passwordSchema, password)).toEqual([`: ${message}`]);
	});

	it("reports every broken rule together", () => {
		expect(issuesOf(passwordSchema, "abc")).toEqual([
			`: ${TOO_SHORT}`,
			`: ${NO_UPPER}`,
			`: ${NO_DIGIT}`,
			`: ${NO_SPECIAL}`,
		]);
	});

	it.each(SPECIALS)("accepts %s as the special character", (special) => {
		expect(issuesOf(passwordSchema, `Abcdef1${special}`)).toEqual([]);
	});
});

describe("signInFormSchema password", () => {
	const signIn = (password: string) =>
		issuesOf(signInFormSchema, { identifier: "demo", password });

	it("refuses seven characters with the length message", () => {
		expect(signIn("1234567")).toEqual([`password: ${TOO_SHORT}`]);
	});

	it("accepts eight characters", () => {
		expect(signIn("12345678")).toEqual([]);
	});
});

describe("resetPasswordFormSchema", () => {
	it("accepts matching strong passwords", () => {
		const input = { password: STRONG, confirmPassword: STRONG };
		expect(outputOf(resetPasswordFormSchema, input)).toEqual(input);
	});

	it("reports a mismatch against the confirmation field", () => {
		const input = { password: STRONG, confirmPassword: "Other1!x" };
		expect(issuesOf(resetPasswordFormSchema, input)).toEqual([
			`confirmPassword: ${MISMATCH}`,
		]);
	});

	it("applies the strong-password rules to the password", () => {
		const input = { password: "abc", confirmPassword: "abc" };
		expect(issuesOf(resetPasswordFormSchema, input)).toContain(
			`password: ${NO_UPPER}`
		);
	});
});

describe("changePasswordFormSchema", () => {
	const change = (fields: object) => ({
		currentPassword: "ab",
		newPassword: STRONG,
		confirmPassword: STRONG,
		...fields,
	});

	it("accepts two-character current passwords and a matching new one", () => {
		expect(outputOf(changePasswordFormSchema, change({}))).toEqual(change({}));
	});

	it("refuses a one-character current password", () => {
		expect(
			issuesOf(changePasswordFormSchema, change({ currentPassword: "a" }))
		).toEqual([
			"currentPassword: Current password must be at least 2 characters",
		]);
	});

	it("refuses a one-character confirmation", () => {
		const input = change({ confirmPassword: "a" });
		expect(issuesOf(changePasswordFormSchema, input)).toContain(
			"confirmPassword: Confirm password must be at least 2 characters"
		);
	});

	it("reports a mismatch against the confirmation field", () => {
		expect(
			issuesOf(
				changePasswordFormSchema,
				change({ confirmPassword: "Other1!x" })
			)
		).toEqual([`confirmPassword: ${MISMATCH}`]);
	});

	it("applies the strong-password rules to the new password", () => {
		const input = change({ newPassword: "abc", confirmPassword: "abc" });
		expect(issuesOf(changePasswordFormSchema, input)).toContain(
			`newPassword: ${NO_UPPER}`
		);
	});
});

describe("registerFormSchema", () => {
	const register = (fields: object) => ({
		username: "demo_user",
		email: "Demo@Example.com",
		password1: STRONG,
		password2: STRONG,
		...fields,
	});

	it("accepts a full registration and lowercases the email", () => {
		expect(outputOf(registerFormSchema, register({}))).toEqual(
			register({ email: "demo@example.com" })
		);
	});

	it.each([
		["username", { username: "ab" }],
		["email", { email: "nope" }],
		["password1", { password1: "abc" }],
		["password2", { password2: "abc" }],
	])("checks the %s field", (field, fields) => {
		const reported = issuesOf(registerFormSchema, register(fields));
		expect(reported.every((line) => line.startsWith(`${field}:`))).toBe(true);
		expect(reported.length).toBeGreaterThan(0);
	});
});

describe("forgotPasswordFormSchema", () => {
	it("accepts an address and lowercases it", () => {
		expect(outputOf(forgotPasswordFormSchema, { email: "A@B.co" })).toEqual({
			email: "a@b.co",
		});
	});

	it("refuses text that is not an address", () => {
		expect(issuesOf(forgotPasswordFormSchema, { email: "nope" })).toEqual([
			"email: Please enter a valid email address",
		]);
	});
});

describe("personalInfoFormSchema", () => {
	it("accepts a profile with names left out", () => {
		const input = { username: "demo", email: "a@b.co" };
		expect(outputOf(personalInfoFormSchema, input)).toEqual(input);
	});

	it("keeps the names that are given", () => {
		const input = {
			firstName: "Ada",
			lastName: "Lovelace",
			username: "demo",
			email: "a@b.co",
		};
		expect(outputOf(personalInfoFormSchema, input)).toEqual(input);
	});

	it("checks the username", () => {
		const input = { username: "ab", email: "a@b.co" };
		expect(issuesOf(personalInfoFormSchema, input)).toEqual([
			"username: Username must be at least 3 characters",
		]);
	});
});

describe("registerUserSchema", () => {
	const base = { username: "demo", email: "a@b.co" };

	it("accepts a single password", () => {
		expect(outputOf(registerUserSchema, { ...base, password: "x" })).toEqual({
			...base,
			password: "x",
		});
	});

	it("takes the password from password1 when password is absent", () => {
		const output = outputOf(registerUserSchema, { ...base, password1: "one" });
		expect(output).toEqual({ ...base, password1: "one", password: "one" });
	});

	it("prefers password over password1", () => {
		const output = outputOf(registerUserSchema, {
			...base,
			password: "first",
			password1: "second",
		});
		expect(output).toMatchObject({ password: "first" });
	});

	it("asks for a password when none is given", () => {
		expect(issuesOf(registerUserSchema, base)).toEqual([
			"password: Password is required",
		]);
	});

	it.each(["password", "password1"])("refuses an empty %s", (field) => {
		expect(issuesOf(registerUserSchema, { ...base, [field]: "" })).toContain(
			`${field}: Password is required`
		);
	});

	it("accepts password1 equal to password2", () => {
		const input = { ...base, password1: "same", password2: "same" };
		expect(issuesOf(registerUserSchema, input)).toEqual([]);
	});

	it("reports a mismatch against password2", () => {
		const input = { ...base, password1: "one", password2: "two" };
		expect(issuesOf(registerUserSchema, input)).toEqual([
			`password2: ${MISMATCH}`,
		]);
	});

	it.each([
		["password1 only", { password1: "one" }],
		["password only", { password: "one" }],
	])("does not compare when given %s", (_name, fields) => {
		expect(issuesOf(registerUserSchema, { ...base, ...fields })).toEqual([]);
	});

	it.each([
		"password",
		"password1",
	])("accepts %s with an equal password2", (field) => {
		const input = { ...base, [field]: "same", password2: "same" };
		expect(issuesOf(registerUserSchema, input)).toEqual([]);
	});

	it.each([
		["password", "two"],
		["password", ""],
		["password1", "two"],
		["password1", ""],
	])("reports a mismatch for %s with password2 %j", (field, password2) => {
		const input = { ...base, [field]: "one", password2 };
		expect(issuesOf(registerUserSchema, input)).toEqual([
			`password2: ${MISMATCH}`,
		]);
	});

	it.each([
		"",
		"two",
	])("asks only for a password when none is given and password2 is %j", (password2) => {
		expect(issuesOf(registerUserSchema, { ...base, password2 })).toEqual([
			"password: Password is required",
		]);
	});

	it.each([
		["password", "first"],
		["password1", "second"],
	])("compares password2 with password when both fields differ (password2 equals %s)", (field, password2) => {
		const input = {
			...base,
			password: "first",
			password1: "second",
			password2,
		};
		expect(issuesOf(registerUserSchema, input)).toEqual(
			field === "password" ? [] : [`password2: ${MISMATCH}`]
		);
	});
});

describe("updateUserProfileSchema", () => {
	it.each([
		["a username", { username: "demo" }],
		["a first name", { firstName: "Ada" }],
		["a last name", { lastName: "Lovelace" }],
		["an email", { email: "A@B.co" }],
		["a username and a blank first name", { username: "d", firstName: "" }],
	])("accepts an update with %s", (_name, input) => {
		expect(issuesOf(updateUserProfileSchema, input)).toEqual([]);
	});

	it.each([["nothing", {}]])("refuses an update with %s", (_name, input) => {
		expect(issuesOf(updateUserProfileSchema, input)).toEqual([
			": At least one field to update must be provided",
		]);
	});

	it("asks for a username when one is given blank", () => {
		expect(issuesOf(updateUserProfileSchema, { username: " " })).toEqual([
			"username: Username is required",
		]);
	});

	it.each([
		["absent", {}, undefined],
		["null", { firstName: null, lastName: null }, null],
		["empty", { firstName: "", lastName: "" }, null],
		["only spaces", { firstName: "  ", lastName: "  " }, null],
		["text", { firstName: " Ada ", lastName: " Lovelace " }, "text"],
	])("reads a %s first and last name", (_name, body, expected) => {
		const out = outputOf(updateUserProfileSchema, {
			username: "demo",
			...body,
		}) as { firstName?: string | null; lastName?: string | null };
		expect(out.firstName).toBe(
			expected === "text" ? "Ada" : (expected as null | undefined)
		);
		expect(out.lastName).toBe(
			expected === "text" ? "Lovelace" : (expected as null | undefined)
		);
	});

	it("accepts an update that only clears a name", () => {
		expect(issuesOf(updateUserProfileSchema, { firstName: null })).toEqual([]);
		expect(issuesOf(updateUserProfileSchema, { lastName: "" })).toEqual([]);
	});

	it("lowercases the email", () => {
		expect(outputOf(updateUserProfileSchema, { email: "A@B.co" })).toEqual({
			email: "a@b.co",
		});
	});
});

describe("deleteAccountSchema", () => {
	it.each([{}, { password: "secret" }])("accepts %j", (input) => {
		expect(outputOf(deleteAccountSchema, input)).toEqual(input);
	});

	it("refuses a key it does not know", () => {
		expect(issuesOf(deleteAccountSchema, { other: 1 })).toHaveLength(1);
	});
});
