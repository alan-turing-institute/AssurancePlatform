import { afterEach, describe, expect, it, vi } from "vitest";
import {
	apiError,
	apiImportFailure,
	apiImportValidationError,
	apiRateLimited,
	apiSuccess,
	requireAuth,
	requireAuthSession,
} from "../api-response";
import { AppError, notFound, validationError } from "../errors";

const validateSessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/validate-session", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/auth/validate-session")>()),
	validateSession: validateSessionMock,
}));

afterEach(() => {
	validateSessionMock.mockReset();
});

describe("apiError", () => {
	it("sends the message, code and status of the error", async () => {
		const response = apiError(notFound("Case"));

		expect(response.status).toBe(404);
		expect(await response.json()).toStrictEqual({
			error: "Case not found",
			code: "NOT_FOUND",
		});
	});

	it("carries field errors in the body when the error has them", async () => {
		const response = apiError(
			validationError("Invalid input", { title: "Required" })
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toStrictEqual({
			error: "Invalid input",
			code: "VALIDATION",
			fieldErrors: { title: "Required" },
		});
	});

	it("leaves out field errors when the error has none", async () => {
		const response = apiError(validationError("Invalid input"));

		expect(await response.json()).toStrictEqual({
			error: "Invalid input",
			code: "VALIDATION",
		});
	});
});

describe("apiSuccess", () => {
	it("sends the data with status 200 by default", async () => {
		const response = apiSuccess({ id: "abc" });

		expect(response.status).toBe(200);
		expect(await response.json()).toStrictEqual({ id: "abc" });
	});

	it("sends the status it is given", async () => {
		const response = apiSuccess({ id: "abc" }, 201);

		expect(response.status).toBe(201);
		expect(await response.json()).toStrictEqual({ id: "abc" });
	});
});

describe("apiImportValidationError", () => {
	it("sends a 400 with the list of messages at the top level", async () => {
		const response = apiImportValidationError("The file is not valid", [
			"elements.0.name: Required",
			"elements.1.name: Required",
		]);

		expect(response.status).toBe(400);
		expect(await response.json()).toStrictEqual({
			error: "The file is not valid",
			code: "VALIDATION",
			validationErrors: [
				"elements.0.name: Required",
				"elements.1.name: Required",
			],
		});
	});
});

describe("apiRateLimited", () => {
	it("answers 429 with the reason and the RATE_LIMITED code", async () => {
		const response = apiRateLimited("Too many attempts");

		expect(response.status).toBe(429);
		expect(await response.json()).toStrictEqual({
			error: "Too many attempts",
			code: "RATE_LIMITED",
		});
	});

	it("sends no retry header when no wait is given", () => {
		expect(apiRateLimited("Slow down").headers.has("Retry-After")).toBe(false);
	});

	it.each([
		[1000, "1"],
		[1001, "2"],
		[1500, "2"],
		[30_000, "30"],
		[999, "1"],
	])("sends a wait of %i ms as %s seconds, rounded up", (ms, seconds) => {
		expect(apiRateLimited("Slow down", ms).headers.get("Retry-After")).toBe(
			seconds
		);
	});
});

describe("apiImportFailure", () => {
	it("sends the list of validation messages when the file failed validation", async () => {
		const response = apiImportFailure({
			error: "The file is not valid",
			validationErrors: ["elements.0.name: Required"],
		});

		expect(response.status).toBe(400);
		expect(await response.json()).toStrictEqual({
			error: "The file is not valid",
			code: "VALIDATION",
			validationErrors: ["elements.0.name: Required"],
		});
	});

	it.each([
		["no list", undefined],
		["an empty list", []],
	])("maps the service message to an error answer when given %s", async (_label, validationErrors) => {
		const response = apiImportFailure({
			error: "Case not found",
			validationErrors,
		});

		expect(response.status).toBe(404);
		expect(await response.json()).toStrictEqual({
			error: "Case not found",
			code: "NOT_FOUND",
		});
	});
});

describe("requireAuthSession", () => {
	it("returns the validated session", async () => {
		const session = {
			userId: "user-1",
			username: "test-user",
			email: "test-user@example.test",
		};
		validateSessionMock.mockResolvedValue(session);

		await expect(requireAuthSession()).resolves.toStrictEqual(session);
	});

	it("throws an unauthorised error when there is no session", async () => {
		validateSessionMock.mockResolvedValue(null);

		const failure = await requireAuthSession().catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(AppError);
		expect(failure).toMatchObject({ code: "UNAUTHORISED", statusCode: 401 });
	});
});

describe("requireAuth", () => {
	it("returns the user id of the validated session", async () => {
		validateSessionMock.mockResolvedValue({
			userId: "user-1",
			username: null,
			email: null,
		});

		await expect(requireAuth()).resolves.toBe("user-1");
	});

	it("throws an unauthorised error when there is no session", async () => {
		validateSessionMock.mockResolvedValue(null);

		const failure = await requireAuth().catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(AppError);
		expect(failure).toMatchObject({ code: "UNAUTHORISED", statusCode: 401 });
	});
});
