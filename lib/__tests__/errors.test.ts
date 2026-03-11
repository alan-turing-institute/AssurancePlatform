import { describe, expect, it, vi } from "vitest";
import { serviceErrorToAppError } from "../api-response";
import {
	AppError,
	forbidden,
	handleError,
	notFound,
	toActionResult,
	unauthorised,
	validationError,
} from "../errors";

describe("AppError", () => {
	it("stores code, message, and fieldErrors", () => {
		const err = new AppError({
			code: "VALIDATION",
			message: "Bad input",
			fieldErrors: { name: "Required" },
		});

		expect(err.code).toBe("VALIDATION");
		expect(err.message).toBe("Bad input");
		expect(err.fieldErrors).toEqual({ name: "Required" });
		expect(err.name).toBe("AppError");
	});

	it("maps error codes to HTTP status codes", () => {
		expect(new AppError({ code: "UNAUTHORISED", message: "" }).statusCode).toBe(
			401
		);
		expect(new AppError({ code: "FORBIDDEN", message: "" }).statusCode).toBe(
			403
		);
		expect(new AppError({ code: "NOT_FOUND", message: "" }).statusCode).toBe(
			404
		);
		expect(new AppError({ code: "VALIDATION", message: "" }).statusCode).toBe(
			400
		);
		expect(new AppError({ code: "CONFLICT", message: "" }).statusCode).toBe(
			409
		);
		expect(new AppError({ code: "RATE_LIMITED", message: "" }).statusCode).toBe(
			429
		);
		expect(new AppError({ code: "INTERNAL", message: "" }).statusCode).toBe(
			500
		);
	});

	it("preserves cause", () => {
		const cause = new Error("original");
		const err = new AppError({ code: "INTERNAL", message: "wrapped", cause });

		expect(err.cause).toBe(cause);
	});
});

describe("factory functions", () => {
	it("unauthorised() creates a 401 error", () => {
		const err = unauthorised();
		expect(err.code).toBe("UNAUTHORISED");
		expect(err.message).toBe("Unauthorised");
		expect(err.statusCode).toBe(401);
	});

	it("unauthorised() accepts a custom message", () => {
		const err = unauthorised("Session expired");
		expect(err.message).toBe("Session expired");
	});

	it("forbidden() creates a 403 error", () => {
		const err = forbidden();
		expect(err.code).toBe("FORBIDDEN");
		expect(err.message).toBe("Permission denied");
		expect(err.statusCode).toBe(403);
	});

	it("notFound() creates a 404 error", () => {
		const err = notFound();
		expect(err.message).toBe("Not found");
	});

	it("notFound() includes the resource name", () => {
		const err = notFound("Case");
		expect(err.message).toBe("Case not found");
	});

	it("validationError() creates a 400 error with field errors", () => {
		const err = validationError("Invalid input", { email: "Required" });
		expect(err.code).toBe("VALIDATION");
		expect(err.statusCode).toBe(400);
		expect(err.fieldErrors).toEqual({ email: "Required" });
	});
});

describe("handleError", () => {
	it("passes through AppError instances", () => {
		const original = forbidden();
		const result = handleError(original);

		expect(result).toBe(original);
	});

	it("wraps a plain Error as INTERNAL", () => {
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
			/* suppress */
		});
		const original = new Error("something broke");
		const result = handleError(original);

		expect(result).toBeInstanceOf(AppError);
		expect(result.code).toBe("INTERNAL");
		expect(result.cause).toBe(original);
		consoleSpy.mockRestore();
	});

	it("wraps non-Error values as INTERNAL", () => {
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
			/* suppress */
		});
		const result = handleError("string error");

		expect(result).toBeInstanceOf(AppError);
		expect(result.code).toBe("INTERNAL");
		consoleSpy.mockRestore();
	});
});

describe("toActionResult", () => {
	it("converts AppError to a failed ActionResult", () => {
		const err = validationError("Bad input", { name: "Too short" });
		const result = toActionResult(err);

		expect(result).toEqual({
			success: false,
			error: "Bad input",
			fieldErrors: { name: "Too short" },
		});
	});

	it("omits fieldErrors when not present", () => {
		const err = notFound("Case");
		const result = toActionResult(err);

		expect(result).toEqual({
			success: false,
			error: "Case not found",
		});
		expect("fieldErrors" in result).toBe(false);
	});
});

describe("serviceErrorToAppError", () => {
	it("maps 'Permission denied' to FORBIDDEN", () => {
		const err = serviceErrorToAppError("Permission denied");
		expect(err.code).toBe("FORBIDDEN");
		expect(err.message).toBe("Permission denied");
	});

	it("maps 'Unauthorised' to UNAUTHORISED", () => {
		const err = serviceErrorToAppError("Unauthorised");
		expect(err.code).toBe("UNAUTHORISED");
		expect(err.message).toBe("Unauthorised");
	});

	it("maps 'not found' errors to NOT_FOUND", () => {
		const err = serviceErrorToAppError("Case not found");
		expect(err.code).toBe("NOT_FOUND");
		expect(err.message).toBe("Case not found");
	});

	it("maps 'already' errors to CONFLICT", () => {
		const err = serviceErrorToAppError("Case is already in trash");
		expect(err.code).toBe("CONFLICT");
		expect(err.message).toBe("Case is already in trash");
	});

	it("is case-insensitive", () => {
		expect(serviceErrorToAppError("PERMISSION DENIED").code).toBe("FORBIDDEN");
		expect(serviceErrorToAppError("Not Found").code).toBe("NOT_FOUND");
	});

	it("falls back to INTERNAL for unknown errors", () => {
		const err = serviceErrorToAppError("Something unexpected");
		expect(err.code).toBe("INTERNAL");
		expect(err.message).toBe("Something unexpected");
	});
});
