import { describe, expect, it } from "vitest";
import { serviceErrorToAppError } from "../api-response";

const REFUSAL = "Invalid or expired reset token";

/** Messages that resemble the refusal but are not it. */
const NEAR_MISSES: [label: string, message: string][] = [
	["a full stop added", `${REFUSAL}.`],
	["a trailing newline", `${REFUSAL}\n`],
	["a trailing space", `${REFUSAL} `],
	["a leading space", ` ${REFUSAL}`],
	["a prefix", `Error: ${REFUSAL}`],
	["a suffix", `${REFUSAL}: connection reset`],
	["a plural", "Invalid or expired reset tokens"],
	["lower case", REFUSAL.toLowerCase()],
	["upper case", REFUSAL.toUpperCase()],
	[
		"the word reset left out (the integration token refusal)",
		"Invalid or expired token",
	],
	["only the first half", "Invalid or expired"],
	["a different adjective", "Invalid reset token"],
];

describe("serviceErrorToAppError for a refused reset link", () => {
	it("maps the refusal to a 400 validation error and keeps its message", () => {
		const error = serviceErrorToAppError(REFUSAL);

		expect(error.code).toBe("VALIDATION");
		expect(error.statusCode).toBe(400);
		expect(error.message).toBe(REFUSAL);
	});

	it.each(
		NEAR_MISSES
	)("leaves a message with %s as an internal error", (_label, message) => {
		const error = serviceErrorToAppError(message);

		expect(error.code).toBe("INTERNAL");
		expect(error.statusCode).toBe(500);
		expect(error.message).toBe(message);
	});

	it("keeps an earlier refusal's status when the message also contains the phrase", () => {
		const message = `Permission denied: ${REFUSAL}`;

		expect(serviceErrorToAppError(message).code).toBe("FORBIDDEN");
	});

	it("does not change the status of the messages listed before it", () => {
		expect(serviceErrorToAppError("Case not found").statusCode).toBe(404);
		expect(serviceErrorToAppError("Case is already in trash").statusCode).toBe(
			409
		);
		expect(serviceErrorToAppError("Invalid file type").statusCode).toBe(400);
		expect(
			serviceErrorToAppError("2 elements still to fill in").statusCode
		).toBe(400);
	});
});
