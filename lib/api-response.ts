import { NextResponse } from "next/server";
import type { ErrorCode } from "@/types/domain";
import { validateSession } from "./auth/validate-session";
import {
	AppError,
	forbidden,
	handleError,
	notFound,
	unauthorised,
} from "./errors";

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

type ApiErrorBody = {
	error: string;
	code: ErrorCode;
	fieldErrors?: Record<string, string>;
};

/** Create a JSON error response from an `AppError`. */
export function apiError(error: AppError): NextResponse<ApiErrorBody> {
	return NextResponse.json(
		{
			error: error.message,
			code: error.code,
			...(error.fieldErrors && { fieldErrors: error.fieldErrors }),
		},
		{ status: error.statusCode }
	);
}

/** Create a JSON error response from an unknown caught value. */
export function apiErrorFromUnknown(
	error: unknown
): NextResponse<ApiErrorBody> {
	return apiError(handleError(error));
}

/** Create a JSON success response. */
export function apiSuccess<T>(data: T, status = 200): NextResponse<T> {
	return NextResponse.json(data, { status });
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

/**
 * Validates the session and returns the user ID.
 * Throws `unauthorised()` if no valid session exists.
 */
export async function requireAuth(): Promise<string> {
	const session = await validateSession();
	if (!session) {
		throw unauthorised();
	}
	return session.userId;
}

// ---------------------------------------------------------------------------
// Service error mapping
// ---------------------------------------------------------------------------

const ERROR_MAPPINGS: Array<{ pattern: string; factory: () => AppError }> = [
	{ pattern: "Permission denied", factory: () => forbidden() },
	{ pattern: "unauthorised", factory: () => unauthorised() },
	{ pattern: "not found", factory: () => notFound() },
	{
		pattern: "already",
		factory: () => new AppError({ code: "CONFLICT", message: "" }),
	},
];

/**
 * Converts a service-layer error string into an `AppError`.
 * Matches known patterns (case-insensitive) and falls back to INTERNAL.
 */
export function serviceErrorToAppError(error: string): AppError {
	const lower = error.toLowerCase();
	for (const { pattern, factory } of ERROR_MAPPINGS) {
		if (lower.includes(pattern.toLowerCase())) {
			// Preserve the original message from the service
			const appError = factory();
			return new AppError({
				code: appError.code,
				message: error,
			});
		}
	}

	return new AppError({ code: "INTERNAL", message: error });
}
