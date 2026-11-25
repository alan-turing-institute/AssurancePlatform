import { describe, expect, it } from "vitest";
import { issuesOf } from "@/src/__tests__/utils/schema-issues-kit";
import {
	changePasswordSchema,
	forgotPasswordSchema,
	resetPasswordSchema,
} from "../auth";

describe("resetPasswordSchema", () => {
	it("accepts a token with a one-character password", () => {
		expect(
			issuesOf(resetPasswordSchema, { token: "t", password: "p" })
		).toEqual([]);
	});

	it.each([
		[{ token: "", password: "p" }, "token: Token is required"],
		[{ token: "t", password: "" }, "password: Password is required"],
	])("asks for the empty field %j", (input, expected) => {
		expect(issuesOf(resetPasswordSchema, input)).toEqual([expected]);
	});
});

describe("changePasswordSchema", () => {
	it("accepts one-character passwords", () => {
		expect(
			issuesOf(changePasswordSchema, { currentPassword: "a", newPassword: "b" })
		).toEqual([]);
	});

	it.each([
		[
			{ currentPassword: "", newPassword: "b" },
			"currentPassword: Current password is required",
		],
		[
			{ currentPassword: "a", newPassword: "" },
			"newPassword: New password is required",
		],
	])("asks for the empty field %j", (input, expected) => {
		expect(issuesOf(changePasswordSchema, input)).toEqual([expected]);
	});
});

describe("forgotPasswordSchema", () => {
	it("accepts any non-empty text, even if it is not an address", () => {
		expect(issuesOf(forgotPasswordSchema, { email: "not-an-email" })).toEqual(
			[]
		);
	});

	it("asks for an email when the field is empty", () => {
		expect(issuesOf(forgotPasswordSchema, { email: "" })).toEqual([
			"email: Email is required",
		]);
	});

	it("asks for an email when the field is absent", () => {
		expect(issuesOf(forgotPasswordSchema, {})).toEqual([
			"email: Email is required",
		]);
	});
});
