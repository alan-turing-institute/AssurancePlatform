import { describe, expect, it } from "vitest";
import { serviceErrorToAppError } from "../api-response";
import { validatePassword } from "../validation/validators";

/** A password that fails exactly one rule, for each of the four rules. */
const WEAK_PASSWORDS = [
	["too short", "Ab1!"],
	["no uppercase letter", "lowercase1!"],
	["no number", "NoNumbers!!"],
	["no special character", "NoSpecial123"],
];

const NEAR_MISSES = [
	"Password must be at least 8 characters.",
	"Password must be at least 8 characters\n",
	"password must be at least 8 characters",
	"Error: Password must contain at least one number",
	"Password must contain at least one letter",
	"Password must contain at least one number: connection reset",
];

describe("serviceErrorToAppError for a weak password", () => {
	it.each(
		WEAK_PASSWORDS
	)("maps the refusal for a password with %s to a 400 and keeps its message", (_label, password) => {
		const result = validatePassword(password);
		if (result.valid) {
			throw new Error("expected the password to be refused");
		}

		const error = serviceErrorToAppError(result.error);

		expect(error.statusCode).toBe(400);
		expect(error.code).toBe("VALIDATION");
		expect(error.message).toBe(result.error);
	});

	it.each(NEAR_MISSES)("leaves %j as an internal error", (message) => {
		expect(serviceErrorToAppError(message).statusCode).toBe(500);
	});
});

describe("serviceErrorToAppError for the other change-password refusals", () => {
	it("maps a wrong current password to 400", () => {
		const error = serviceErrorToAppError("Current password is incorrect");

		expect(error.statusCode).toBe(400);
		expect(error.message).toBe("Current password is incorrect");
	});

	it.each([
		"Password change is not available for OAuth accounts",
		"No password set for this account",
	])("maps %j to 403", (message) => {
		expect(serviceErrorToAppError(message).statusCode).toBe(403);
	});

	it("leaves a message that only contains the phrase as an internal error", () => {
		expect(
			serviceErrorToAppError("Current password is incorrect, try again")
				.statusCode
		).toBe(500);
	});
});
