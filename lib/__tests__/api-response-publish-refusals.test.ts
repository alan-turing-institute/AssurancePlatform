import { describe, expect, it } from "vitest";
import { serviceErrorToAppError } from "../api-response";

const INCOMPLETE =
	"Case information is incomplete — add the missing fields before publishing";

describe("serviceErrorToAppError for the publish refusals", () => {
	it.each([
		"Case is not published",
		"No published version found",
		"Invalid status transition: DRAFT to DRAFT",
		"Invalid status transition: PUBLISHED to PUBLISHED",
	])("maps %s to a 409 conflict and keeps its message", (message) => {
		const error = serviceErrorToAppError(message);

		expect(error.code).toBe("CONFLICT");
		expect(error.statusCode).toBe(409);
		expect(error.message).toBe(message);
	});

	it("maps the incomplete case information refusal to a 400 validation error", () => {
		const error = serviceErrorToAppError(INCOMPLETE);

		expect(error.code).toBe("VALIDATION");
		expect(error.statusCode).toBe(400);
		expect(error.message).toBe(INCOMPLETE);
	});

	it.each([
		"Case is not published yet",
		"The case is not published",
		"No published version found for this case",
		"Failed: Invalid status transition: DRAFT to DRAFT",
		`${INCOMPLETE}.`,
	])("leaves the look-alike %s as an internal error", (message) => {
		const error = serviceErrorToAppError(message);

		expect(error.code).toBe("INTERNAL");
		expect(error.statusCode).toBe(500);
	});
});
