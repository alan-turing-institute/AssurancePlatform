import { resolveDbPoolTimeoutMs } from "@/lib/db-pool-config";
import { logger } from "@/lib/logger";

/**
 * Classifies errors for consistent handling across API routes, server actions, and services.
 */
export type ErrorCode =
	| "UNAUTHORISED"
	| "FORBIDDEN"
	| "NOT_FOUND"
	| "VALIDATION"
	| "CONFLICT"
	| "RATE_LIMITED"
	| "PAYLOAD_TOO_LARGE"
	| "GATEWAY_TIMEOUT"
	| "DB_UNAVAILABLE"
	| "INTERNAL";

/**
 * Standard result type for Server Actions.
 * Use this for all mutation Server Actions to provide consistent error handling.
 */
export type ActionResult<T> =
	| { success: true; data: T }
	| { success: false; error: string; fieldErrors?: Record<string, string> };

const STATUS_MAP: Record<ErrorCode, number> = {
	UNAUTHORISED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	VALIDATION: 400,
	CONFLICT: 409,
	RATE_LIMITED: 429,
	PAYLOAD_TOO_LARGE: 413,
	GATEWAY_TIMEOUT: 504,
	DB_UNAVAILABLE: 503,
	INTERNAL: 500,
};

interface AppErrorOptions {
	cause?: unknown;
	code: ErrorCode;
	fieldErrors?: Record<string, string>;
	message: string;
}

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

export function gatewayTimeout(message = "Request timed out"): AppError {
	return new AppError({ code: "GATEWAY_TIMEOUT", message });
}

export function payloadTooLarge(message = "Request body too large"): AppError {
	return new AppError({ code: "PAYLOAD_TOO_LARGE", message });
}

export function dbUnavailable(
	message = "The database is temporarily unavailable. Please try again."
): AppError {
	return new AppError({ code: "DB_UNAVAILABLE", message });
}

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

/**
 * Messages `pg-pool` throws as a plain `Error` (no `.code`, no `.cause` in
 * the common case) when `connectionTimeoutMillis` elapses:
 * - "timeout exceeded when trying to connect" — every pool slot was already
 *   checked out and the wait for one to free up timed out (the queued-wait
 *   path, `pg-pool/index.js`'s `_pendingQueue` timeout — this is the shape
 *   `api-status-pool-starvation.test.ts` reproduces).
 * - "Connection terminated due to connection timeout" — a brand-new
 *   connection (pool below `max`) didn't finish establishing within the
 *   timeout. Different code path, same configured value, same "the database
 *   isn't responding fast enough" signal.
 * Matched by substring, not exact equality, since the second message is
 * pg-pool's own `new Error(..., { cause })` wrapping and could gain a suffix.
 */
const POOL_ACQUIRE_TIMEOUT_MESSAGES = [
	"timeout exceeded when trying to connect",
	"Connection terminated due to connection timeout",
];

function isPoolAcquireTimeoutError(error: Error): boolean {
	return POOL_ACQUIRE_TIMEOUT_MESSAGES.some((message) =>
		error.message.includes(message)
	);
}

/**
 * Wraps an unknown caught value into an `AppError`.
 * Passes through existing `AppError` instances unchanged.
 */
export function handleError(error: unknown): AppError {
	if (error instanceof AppError) {
		return error;
	}

	// `TimeoutError` (`lib/with-timeout.ts`) is checked by name, not
	// `instanceof` — it's thrown from a plain module with no shared base
	// class import here, and matching by `.name` avoids a circular import
	// between `lib/errors.ts` and `lib/with-timeout.ts`.
	if (error instanceof Error && error.name === "TimeoutError") {
		console.error("[handleError] request timed out:", error.message);
		return gatewayTimeout(
			"The request took too long to complete. Please try again."
		);
	}

	// A pg-pool connection-acquisition timeout is a distinct, expected
	// failure shape (the pool is saturated or Postgres is slow to accept new
	// connections) — not an unexpected bug. Without this check it fell
	// through to the generic INTERNAL/500 branch below, indistinguishable in
	// production logs from any other unhandled error (see "TEA —
	// Pool-timeout errors indistinguishable from generic 500s").
	if (error instanceof Error && isPoolAcquireTimeoutError(error)) {
		logger.error("Database connection pool acquisition timed out", {
			event: "db.pool.acquire_timeout",
			timeoutMs: resolveDbPoolTimeoutMs(),
		});
		return dbUnavailable();
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
