import type { NextResponse } from "next/server";
import type { Session } from "next-auth";

/**
 * Check if a session is valid (has user ID and hasn't expired).
 */
export function isValidSession(session: Session | null): boolean {
	if (!session) {
		return false;
	}

	// Check for user ID (required for JWT-only auth)
	if (!session.user?.id) {
		return false;
	}

	// Check NextAuth expiry if present
	if (session.expires) {
		const expiryDate = new Date(session.expires);
		if (expiryDate < new Date()) {
			return false;
		}
	}

	return true;
}

/**
 * Clear authentication cookies from a response
 */
export function clearAuthCookies(response: NextResponse): NextResponse {
	// Clear NextAuth session cookies
	response.cookies.set("next-auth.session-token", "", { maxAge: 0 });
	response.cookies.set("__Secure-next-auth.session-token", "", { maxAge: 0 });
	response.cookies.set("next-auth.csrf-token", "", { maxAge: 0 });
	response.cookies.set("__Secure-next-auth.csrf-token", "", { maxAge: 0 });

	// Clear any custom auth cookies
	response.cookies.set("auth-redirects", "0", { maxAge: 0 });

	return response;
}

/**
 * Map authentication errors to user-friendly messages
 */
export function getAuthError(error: string | undefined): string {
	if (!error) {
		return "An unexpected error occurred. Please try again.";
	}

	const errorMap: Record<string, string> = {
		// NextAuth errors
		CredentialsSignin:
			"Invalid credentials. Please check your username and password.",
		SessionRequired: "Please log in to access this page.",
		OAuthSignin:
			"Error connecting to authentication provider. Please try again.",
		OAuthCallback: "Error during authentication. Please try again.",
		OAuthCreateAccount:
			"Unable to create account. Please try a different method.",
		EmailCreateAccount:
			"Unable to create account with this email. Please try again.",
		Callback: "Authentication callback error. Please try again.",
		OAuthAccountNotLinked: "This account is already linked to another user.",
		EmailSignin: "Unable to send sign-in email. Please try again.",
		Configuration:
			"Authentication configuration error. Please contact support.",
		AccessDenied:
			"Access denied. You don't have permission to access this resource.",
		Verification: "Verification token is invalid or has expired.",

		// Custom errors
		InvalidCredentials:
			"Invalid credentials. Please check your username and password.",
		AccountLocked: "Your account has been locked. Please contact support.",
		NetworkError: "Connection error. Please check your internet and try again.",
		ServerError: "Service temporarily unavailable. Please try again later.",
		SessionExpired: "Your session has expired. Please log in again.",
		RefreshAccessTokenError: "Unable to refresh session. Please log in again.",
	};

	return errorMap[error] || "Authentication error. Please try again.";
}

/**
 * Get error type from URL parameters (for error pages)
 */
export function getErrorFromUrl(searchParams: URLSearchParams): {
	error: string;
	message: string;
} {
	const error = searchParams.get("error") || "Unknown";
	const message = getAuthError(error);

	return { error, message };
}

/**
 * Check if an error is a network/connection error
 */
export function isNetworkError(error: unknown): boolean {
	if (error instanceof Error) {
		const networkErrorPatterns = [
			"fetch failed",
			"network",
			"ECONNREFUSED",
			"ETIMEDOUT",
			"ENOTFOUND",
			"Failed to fetch",
		];

		return networkErrorPatterns.some((pattern) =>
			error.message.toLowerCase().includes(pattern.toLowerCase())
		);
	}

	return false;
}

/**
 * Format error for logging (removes sensitive data)
 */
export function sanitizeErrorForLogging(
	error: unknown
): Record<string, unknown> {
	if (error instanceof Error) {
		return {
			name: error.name,
			message: error.message,
			stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
		};
	}

	if (typeof error === "object" && error !== null) {
		// Remove sensitive fields
		const errorObj = error as Record<string, unknown>;
		const { password: _p, key: _k, token: _t, secret: _s, ...safe } = errorObj;
		return safe;
	}

	return { error: String(error) };
}
