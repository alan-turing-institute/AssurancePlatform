import { NextResponse } from "next/server";
import {
	type ValidatedSession,
	validateSession,
} from "./auth/validate-session";
import {
	AppError,
	type ErrorCode,
	forbidden,
	handleError,
	notFound,
	unauthorised,
	validationError,
} from "./errors";

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

interface ApiErrorBody {
	code: ErrorCode;
	error: string;
	fieldErrors?: Record<string, string>;
}

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

/**
 * Create a 429 Too Many Requests response.
 * Optionally sets the `Retry-After` header in seconds.
 */
export function apiRateLimited(
	reason: string,
	retryAfterMs?: number
): NextResponse<ApiErrorBody> {
	const response = apiError(
		new AppError({ code: "RATE_LIMITED", message: reason })
	);
	if (retryAfterMs) {
		response.headers.set("Retry-After", String(Math.ceil(retryAfterMs / 1000)));
	}
	return response;
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/**
 * Validates the session and returns the user ID.
 * Throws `unauthorised()` if no valid session exists.
 */
export async function requireAuth(): Promise<string> {
	const session = await requireAuthSession();
	return session.userId;
}

/**
 * Validates the session and returns the full session object.
 * Throws `unauthorised()` if no valid session exists.
 * Use this when you need username/email (e.g. for SSE event payloads).
 */
export async function requireAuthSession(): Promise<ValidatedSession> {
	const session = await validateSession();
	if (!session) {
		throw unauthorised();
	}
	return session;
}

// ---------------------------------------------------------------------------
// Service error mapping
// ---------------------------------------------------------------------------

/** A pattern is either a case-insensitive substring, or a `RegExp` for shapes a bare substring would over-match. */
type ErrorPattern = string | RegExp;

function matchesPattern(error: string, pattern: ErrorPattern): boolean {
	if (typeof pattern === "string") {
		return error.toLowerCase().includes(pattern.toLowerCase());
	}
	return pattern.test(error);
}

/** Shared factory for every "the resource exists but is in the wrong state for this action" error below. */
const conflict = () => new AppError({ code: "CONFLICT", message: "" });

const ERROR_MAPPINGS: Array<{
	pattern: ErrorPattern;
	factory: () => AppError;
}> = [
	{ pattern: "Permission denied", factory: () => forbidden() },
	{ pattern: "unauthorised", factory: () => unauthorised() },
	{ pattern: "not found", factory: () => notFound() },
	{ pattern: "already", factory: conflict },
	// `assertPluginEnabledForUser` ("Plugin '<id>' is not enabled",
	// `plugin-enablement-service.ts`'s `assertPluginEnabledForUser`) — a
	// plugin switched off (deployment, or user-level) is a clean, expected
	// refusal for any plugin's machine/human routes, not a 500. Matched here
	// rather than in each plugin route so every current and future plugin
	// gets it for free. Anchored to the producing service's exact message
	// shape (not a bare "not enabled" substring) so an unrelated service
	// error that happens to contain that phrase for a different reason isn't
	// misclassified as a plugin-disabled 403.
	{ pattern: /^Plugin '.+' is not enabled$/, factory: () => forbidden() },
	// `integration-registry-service.ts` / `lib/schemas/integration.ts`
	// (integration management API, work item 7): an unknown scope is a
	// validation failure (400), not an unmapped 500.
	{ pattern: /^Unknown scope/, factory: () => validationError("") },
	// Lifecycle/state-guard errors from the integration registry service —
	// the integration or token exists and is owned by the caller, but its
	// current status makes the requested action a no-op or a terminal-state
	// violation (e.g. reactivating a REVOKED integration, or issuing/
	// rotating a token against one that isn't ACTIVE). None of these contain
	// "already" or "not found", so without this entry they'd fall through to
	// INTERNAL (500) the first time an HTTP route ever surfaced them.
	{
		pattern:
			/^Cannot (suspend|reactivate) a revoked integration$|^Cannot (issue|rotate) a token for a non-active integration$|^Cannot rotate a revoked token$/,
		factory: conflict,
	},
	// `user-management-service.ts`'s `deleteAccount` — owned integrations
	// (ON DELETE RESTRICT) block account deletion until removed (no
	// reassignment path in 1.0). Anchored `^...$` like its two siblings
	// above, not a bare substring (vincent minor, review round 2 — this
	// used to be unanchored, the odd one out of the three lifecycle
	// patterns in this array).
	{
		pattern: /^Remove your \d+ integrations? before deleting your account$/,
		factory: conflict,
	},
];

/**
 * Converts a service-layer error string into an `AppError`.
 * Matches known patterns (case-insensitive for strings) and falls back to INTERNAL.
 */
export function serviceErrorToAppError(error: string): AppError {
	for (const { pattern, factory } of ERROR_MAPPINGS) {
		if (matchesPattern(error, pattern)) {
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
