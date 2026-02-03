import type { ActionResult, ErrorCode } from "@/types/domain";

const STATUS_MAP: Record<ErrorCode, number> = {
	UNAUTHORISED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	VALIDATION: 400,
	CONFLICT: 409,
	RATE_LIMITED: 429,
	INTERNAL: 500,
};

type AppErrorOptions = {
	code: ErrorCode;
	message: string;
	cause?: unknown;
	fieldErrors?: Record<string, string>;
};

/**
 * Structured application error with an error code and optional field-level errors.
 * Use factory functions (`unauthorised`, `forbidden`, etc.) for common cases.
 */
export class AppError extends Error {
	readonly code: ErrorCode;
	readonly fieldErrors?: Record<string, string>;

	constructor({ code, message, cause, fieldErrors }: AppErrorOptions) {
		super(message, { cause });
		this.name = "AppError";
		this.code = code;
		this.fieldErrors = fieldErrors;
	}

	get statusCode(): number {
		return STATUS_MAP[this.code];
	}
}

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

export function unauthorised(message = "Unauthorised"): AppError {
	return new AppError({ code: "UNAUTHORISED", message });
}

export function forbidden(message = "Permission denied"): AppError {
	return new AppError({ code: "FORBIDDEN", message });
}

export function notFound(resource?: string): AppError {
	const message = resource ? `${resource} not found` : "Not found";
	return new AppError({ code: "NOT_FOUND", message });
}

export function validationError(
	message: string,
	fieldErrors?: Record<string, string>
): AppError {
	return new AppError({ code: "VALIDATION", message, fieldErrors });
}

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

/**
 * Wraps an unknown caught value into an `AppError`.
 * Passes through existing `AppError` instances unchanged.
 */
export function handleError(error: unknown): AppError {
	if (error instanceof AppError) {
		return error;
	}

	const message =
		error instanceof Error ? error.message : "An unexpected error occurred";

	console.error("[handleError]", error);

	return new AppError({
		code: "INTERNAL",
		message:
			process.env.NODE_ENV === "production"
				? "An unexpected error occurred"
				: message,
		cause: error,
	});
}

/**
 * Converts an `AppError` into the `ActionResult` shape used by server actions.
 */
export function toActionResult<T>(error: AppError): ActionResult<T> {
	return {
		success: false,
		error: error.message,
		...(error.fieldErrors && { fieldErrors: error.fieldErrors }),
	};
}
