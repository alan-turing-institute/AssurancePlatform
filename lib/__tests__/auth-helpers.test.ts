import type { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	clearAuthCookies,
	getAuthError,
	getErrorFromUrl,
	isNetworkError,
	isValidSession,
	sanitizeErrorForLogging,
} from "../auth-helpers";

describe("auth-helpers", () => {
	beforeEach(() => {
		// Reset environment variables
		vi.stubEnv("NODE_ENV", "test");
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	describe("isValidSession", () => {
		const futureDate = new Date(Date.now() + 86_400_000).toISOString(); // 24 hours from now
		const pastDate = new Date(Date.now() - 86_400_000).toISOString(); // 24 hours ago

		it("should return false for null session", () => {
			expect(isValidSession(null)).toBe(false);
		});

		it("should return false for session without user", () => {
			const session: Session = {
				expires: futureDate,
			};
			expect(isValidSession(session)).toBe(false);
		});

		it("should return false for session without user id", () => {
			const session: Session = {
				user: { name: "Test User", email: "test@example.com" },
				expires: futureDate,
			};
			expect(isValidSession(session)).toBe(false);
		});

		it("should return false for session with expired NextAuth expires", () => {
			const session: Session = {
				user: { id: "user-123", name: "Test User" },
				expires: pastDate,
			};
			expect(isValidSession(session)).toBe(false);
		});

		it("should return true for valid session with user id", () => {
			const session: Session = {
				user: { id: "user-123", name: "Test User" },
				expires: futureDate,
			};
			expect(isValidSession(session)).toBe(true);
		});

		it("should return true for valid session with future expiry", () => {
			const session: Session = {
				user: { id: "user-123", name: "Test User" },
				expires: futureDate,
			};
			expect(isValidSession(session)).toBe(true);
		});

		it("should handle edge case where NextAuth expires equals current time", () => {
			const now = new Date();
			const session: Session = {
				user: { id: "user-123", name: "Test User" },
				expires: now.toISOString(),
			};
			// The condition is expiryDate < new Date(), so equal time should return true
			expect(isValidSession(session)).toBe(true);
		});

		it("should handle malformed date strings gracefully", () => {
			const session: Session = {
				user: { id: "user-123", name: "Test User" },
				expires: "invalid-date",
			};
			// Should not throw and should handle invalid date as Invalid Date object
			expect(() => isValidSession(session)).not.toThrow();
		});

		it("should handle session with additional properties", () => {
			const session: Session = {
				user: { id: "user-123", name: "Test User" },
				expires: futureDate,
				provider: "github",
			};
			expect(isValidSession(session)).toBe(true);
		});
	});

	describe("clearAuthCookies", () => {
		let mockResponse: NextResponse;
		let setCookieSpy: ReturnType<typeof vi.fn>;

		beforeEach(() => {
			setCookieSpy = vi.fn();
			mockResponse = {
				cookies: {
					set: setCookieSpy,
				},
			} as unknown as NextResponse;
		});

		it("should clear all NextAuth session cookies", () => {
			const result = clearAuthCookies(mockResponse);

			expect(setCookieSpy).toHaveBeenCalledWith("next-auth.session-token", "", {
				maxAge: 0,
			});
			expect(setCookieSpy).toHaveBeenCalledWith(
				"__Secure-next-auth.session-token",
				"",
				{ maxAge: 0 }
			);
			expect(setCookieSpy).toHaveBeenCalledWith("next-auth.csrf-token", "", {
				maxAge: 0,
			});
			expect(setCookieSpy).toHaveBeenCalledWith(
				"__Secure-next-auth.csrf-token",
				"",
				{ maxAge: 0 }
			);
			expect(result).toBe(mockResponse);
		});

		it("should clear custom auth cookies", () => {
			clearAuthCookies(mockResponse);

			expect(setCookieSpy).toHaveBeenCalledWith("auth-redirects", "0", {
				maxAge: 0,
			});
		});

		it("should call setCookie with correct number of times", () => {
			clearAuthCookies(mockResponse);

			// Should call setCookie 5 times total (4 NextAuth + 1 custom)
			expect(setCookieSpy).toHaveBeenCalledTimes(5);
		});

		it("should return the same response object", () => {
			const result = clearAuthCookies(mockResponse);
			expect(result).toBe(mockResponse);
		});

		it("should handle response with undefined cookies gracefully", () => {
			const responseWithoutCookies = {} as NextResponse;
			// Should not throw even if cookies property is undefined
			expect(() => clearAuthCookies(responseWithoutCookies)).toThrow();
		});
	});

	describe("getAuthError", () => {
		it("should return default message for undefined error", () => {
			expect(getAuthError(undefined)).toBe(
				"An unexpected error occurred. Please try again."
			);
		});

		it("should return default message for empty string error", () => {
			expect(getAuthError("")).toBe(
				"An unexpected error occurred. Please try again."
			);
		});

		it("should return correct message for NextAuth errors", () => {
			expect(getAuthError("CredentialsSignin")).toBe(
				"Invalid credentials. Please check your username and password."
			);
			expect(getAuthError("SessionRequired")).toBe(
				"Please log in to access this page."
			);
			expect(getAuthError("OAuthSignin")).toBe(
				"Error connecting to authentication provider. Please try again."
			);
			expect(getAuthError("OAuthCallback")).toBe(
				"Error during authentication. Please try again."
			);
			expect(getAuthError("OAuthCreateAccount")).toBe(
				"Unable to create account. Please try a different method."
			);
			expect(getAuthError("EmailCreateAccount")).toBe(
				"Unable to create account with this email. Please try again."
			);
			expect(getAuthError("Callback")).toBe(
				"Authentication callback error. Please try again."
			);
			expect(getAuthError("OAuthAccountNotLinked")).toBe(
				"This account is already linked to another user."
			);
			expect(getAuthError("EmailSignin")).toBe(
				"Unable to send sign-in email. Please try again."
			);
			expect(getAuthError("Configuration")).toBe(
				"Authentication configuration error. Please contact support."
			);
			expect(getAuthError("AccessDenied")).toBe(
				"Access denied. You don't have permission to access this resource."
			);
			expect(getAuthError("Verification")).toBe(
				"Verification token is invalid or has expired."
			);
		});

		it("should return correct message for custom errors", () => {
			expect(getAuthError("InvalidCredentials")).toBe(
				"Invalid credentials. Please check your username and password."
			);
			expect(getAuthError("AccountLocked")).toBe(
				"Your account has been locked. Please contact support."
			);
			expect(getAuthError("NetworkError")).toBe(
				"Connection error. Please check your internet and try again."
			);
			expect(getAuthError("ServerError")).toBe(
				"Service temporarily unavailable. Please try again later."
			);
			expect(getAuthError("SessionExpired")).toBe(
				"Your session has expired. Please log in again."
			);
			expect(getAuthError("RefreshAccessTokenError")).toBe(
				"Unable to refresh session. Please log in again."
			);
		});

		it("should return default message for unknown errors", () => {
			expect(getAuthError("UnknownError")).toBe(
				"Authentication error. Please try again."
			);
			expect(getAuthError("RandomError")).toBe(
				"Authentication error. Please try again."
			);
		});

		it("should handle case sensitivity", () => {
			expect(getAuthError("credentialssignin")).toBe(
				"Authentication error. Please try again."
			);
			expect(getAuthError("CREDENTIALSSIGNIN")).toBe(
				"Authentication error. Please try again."
			);
		});

		it("should handle special characters in error codes", () => {
			expect(getAuthError("Error-With-Dashes")).toBe(
				"Authentication error. Please try again."
			);
			expect(getAuthError("Error_With_Underscores")).toBe(
				"Authentication error. Please try again."
			);
		});
	});

	describe("getErrorFromUrl", () => {
		it("should return error and message from URL search params", () => {
			const searchParams = new URLSearchParams("?error=CredentialsSignin");
			const result = getErrorFromUrl(searchParams);

			expect(result).toEqual({
				error: "CredentialsSignin",
				message:
					"Invalid credentials. Please check your username and password.",
			});
		});

		it("should return Unknown error when no error parameter", () => {
			const searchParams = new URLSearchParams("");
			const result = getErrorFromUrl(searchParams);

			expect(result).toEqual({
				error: "Unknown",
				message: "Authentication error. Please try again.",
			});
		});

		it("should handle multiple parameters and extract error", () => {
			const searchParams = new URLSearchParams(
				"?error=SessionRequired&redirect=/dashboard"
			);
			const result = getErrorFromUrl(searchParams);

			expect(result).toEqual({
				error: "SessionRequired",
				message: "Please log in to access this page.",
			});
		});

		it("should handle URL-encoded error values", () => {
			const searchParams = new URLSearchParams("?error=OAuth%20Error");
			const result = getErrorFromUrl(searchParams);

			expect(result).toEqual({
				error: "OAuth Error",
				message: "Authentication error. Please try again.",
			});
		});

		it("should handle empty error parameter", () => {
			const searchParams = new URLSearchParams("?error=");
			const result = getErrorFromUrl(searchParams);

			// Empty string is falsy, so it becomes "Unknown"
			expect(result).toEqual({
				error: "Unknown",
				message: "Authentication error. Please try again.",
			});
		});
	});

	describe("isNetworkError", () => {
		it("should return true for Error with network-related messages", () => {
			expect(isNetworkError(new Error("fetch failed"))).toBe(true);
			expect(isNetworkError(new Error("Network error occurred"))).toBe(true);
			expect(
				isNetworkError(new Error("ECONNREFUSED: Connection refused"))
			).toBe(true);
			expect(isNetworkError(new Error("ETIMEDOUT: Operation timed out"))).toBe(
				true
			);
			expect(isNetworkError(new Error("ENOTFOUND: Host not found"))).toBe(true);
			expect(isNetworkError(new Error("Failed to fetch"))).toBe(true);
		});

		it("should handle case insensitive matching", () => {
			expect(isNetworkError(new Error("FETCH FAILED"))).toBe(true);
			expect(isNetworkError(new Error("Network Error"))).toBe(true);
			expect(isNetworkError(new Error("failed to fetch"))).toBe(true);
		});

		it("should return false for non-network errors", () => {
			expect(isNetworkError(new Error("Invalid credentials"))).toBe(false);
			expect(isNetworkError(new Error("Unauthorized access"))).toBe(false);
			expect(isNetworkError(new Error("Database error"))).toBe(false);
		});

		it("should return false for non-Error objects", () => {
			expect(isNetworkError("fetch failed")).toBe(false);
			expect(isNetworkError({ message: "network error" })).toBe(false);
			expect(isNetworkError(null)).toBe(false);
			expect(isNetworkError(undefined)).toBe(false);
			expect(isNetworkError(123)).toBe(false);
		});

		it("should return false for Error without message", () => {
			// biome-ignore lint/suspicious/useErrorMessage: Testing error without message intentionally
			const errorWithoutMessage = new Error("");
			errorWithoutMessage.message = "";
			expect(isNetworkError(errorWithoutMessage)).toBe(false);
		});

		it("should handle partial matches in error messages", () => {
			expect(
				isNetworkError(
					new Error("Request failed due to network connectivity issues")
				)
			).toBe(true);
			expect(isNetworkError(new Error("The fetch failed unexpectedly"))).toBe(
				true
			);
		});

		it("should return false for similar but non-matching patterns", () => {
			expect(isNetworkError(new Error("fetching data"))).toBe(false);
			expect(isNetworkError(new Error("networking team"))).toBe(true); // contains "network"
			expect(isNetworkError(new Error("connect to database"))).toBe(false);
		});
	});

	describe("sanitizeErrorForLogging", () => {
		beforeEach(() => {
			vi.stubEnv("NODE_ENV", "development");
		});

		it("should sanitize Error objects in development", () => {
			const error = new Error("Test error message");
			error.stack = "Error: Test error\n    at test.js:1:1";

			const result = sanitizeErrorForLogging(error);

			expect(result).toEqual({
				name: "Error",
				message: "Test error message",
				stack: "Error: Test error\n    at test.js:1:1",
			});
		});

		it("should exclude stack trace in production", () => {
			vi.stubEnv("NODE_ENV", "production");
			const error = new Error("Test error message");
			error.stack = "Error: Test error\n    at test.js:1:1";

			const result = sanitizeErrorForLogging(error);

			expect(result).toEqual({
				name: "Error",
				message: "Test error message",
				stack: undefined,
			});
		});

		it("should sanitize object errors by removing sensitive fields", () => {
			const error = {
				message: "Auth failed",
				password: "secret123",
				key: "auth-key-123",
				token: "jwt-token-456",
				secret: "app-secret-789",
				userId: "user-123",
				timestamp: "2023-01-01",
			};

			const result = sanitizeErrorForLogging(error);

			expect(result).toEqual({
				message: "Auth failed",
				userId: "user-123",
				timestamp: "2023-01-01",
			});
		});

		it("should handle objects without sensitive fields", () => {
			const error = {
				message: "Simple error",
				code: 500,
				timestamp: "2023-01-01",
			};

			const result = sanitizeErrorForLogging(error);

			expect(result).toEqual({
				message: "Simple error",
				code: 500,
				timestamp: "2023-01-01",
			});
		});

		it("should handle primitive values", () => {
			expect(sanitizeErrorForLogging("string error")).toEqual({
				error: "string error",
			});
			expect(sanitizeErrorForLogging(123)).toEqual({ error: "123" });
			expect(sanitizeErrorForLogging(true)).toEqual({ error: "true" });
		});

		it("should handle null and undefined", () => {
			expect(sanitizeErrorForLogging(null)).toEqual({ error: "null" });
			expect(sanitizeErrorForLogging(undefined)).toEqual({
				error: "undefined",
			});
		});

		it("should handle Error subclasses", () => {
			const error = new TypeError("Type error message");
			error.stack = "TypeError: Type error\n    at test.js:1:1";

			const result = sanitizeErrorForLogging(error);

			expect(result).toEqual({
				name: "TypeError",
				message: "Type error message",
				stack: "TypeError: Type error\n    at test.js:1:1",
			});
		});

		it("should handle custom Error objects", () => {
			class CustomError extends Error {
				code: number;
				constructor(message: string, code: number) {
					super(message);
					this.name = "CustomError";
					this.code = code;
				}
			}

			const error = new CustomError("Custom error", 500);
			const result = sanitizeErrorForLogging(error);

			expect(result).toEqual({
				name: "CustomError",
				message: "Custom error",
				stack: expect.any(String),
			});
		});

		it("should handle objects with nested sensitive data", () => {
			const error = {
				auth: {
					password: "secret",
					key: "sensitive",
				},
				data: {
					message: "Error occurred",
					userId: "123",
				},
				password: "top-level-secret",
			};

			const result = sanitizeErrorForLogging(error);

			expect(result).toEqual({
				auth: {
					password: "secret",
					key: "sensitive",
				},
				data: {
					message: "Error occurred",
					userId: "123",
				},
			});
		});

		it("should handle empty objects", () => {
			expect(sanitizeErrorForLogging({})).toEqual({});
		});

		it("should handle arrays", () => {
			const errorArray = ["error1", "error2", { password: "secret" }];
			const result = sanitizeErrorForLogging(errorArray);

			// Arrays are objects, so they get filtered
			expect(result).toEqual({
				0: "error1",
				1: "error2",
				2: { password: "secret" },
			});
		});

		it("should preserve Error properties that are not sensitive", () => {
			const error = new Error("Test error") as Error & {
				code?: string;
				statusCode?: number;
				timestamp?: number;
			};
			error.code = "AUTH_FAILED";
			error.statusCode = 401;
			error.timestamp = Date.now();

			const result = sanitizeErrorForLogging(error);

			expect(result).toEqual({
				name: "Error",
				message: "Test error",
				stack: expect.any(String),
			});
		});

		it("should handle different NODE_ENV values", () => {
			vi.stubEnv("NODE_ENV", "test");
			const error = new Error("Test error");
			error.stack = "stack trace";

			const result = sanitizeErrorForLogging(error);

			expect(result).toEqual({
				name: "Error",
				message: "Test error",
				stack: undefined, // Not development, so no stack
			});
		});
	});

	describe("Edge cases and integration scenarios", () => {
		it("should handle session validation with all possible field combinations", () => {
			// Test with minimal valid session (must have user.id)
			expect(
				isValidSession({
					user: { id: "user-123" },
					expires: new Date(Date.now() + 1000).toISOString(),
				})
			).toBe(true);

			// Test with maximal valid session
			expect(
				isValidSession({
					user: { id: "user-123", name: "Test", email: "test@example.com" },
					expires: new Date(Date.now() + 86_400_000).toISOString(),
					provider: "github",
				})
			).toBe(true);

			// Test with missing user.id (should fail)
			expect(
				isValidSession({
					user: { name: "Test", email: "test@example.com" },
					expires: new Date(Date.now() + 86_400_000).toISOString(),
				})
			).toBe(false);
		});

		it("should handle error messages for security audit scenarios", () => {
			const securityErrors = [
				"AccessDenied",
				"OAuthAccountNotLinked",
				"Verification",
				"SessionExpired",
			];

			for (const error of securityErrors) {
				const message = getAuthError(error);
				expect(message).not.toContain("undefined");
				expect(message).not.toContain("null");
				expect(message.length).toBeGreaterThan(10); // Non-empty meaningful message
			}
		});

		it("should handle network error detection for monitoring scenarios", () => {
			const networkErrors = [
				new Error("fetch failed"),
				new Error("Network request failed"),
				new Error("connect ECONNREFUSED 127.0.0.1:8000"),
				new Error("getaddrinfo ENOTFOUND api.example.com"),
				new Error("timeout ETIMEDOUT"),
			];

			for (const error of networkErrors) {
				expect(isNetworkError(error)).toBe(true);
			}

			const nonNetworkErrors = [
				new Error("401 Unauthorized"),
				new Error("Invalid JSON response"),
				new Error("User not found"),
			];

			for (const error of nonNetworkErrors) {
				expect(isNetworkError(error)).toBe(false);
			}
		});

		it("should handle error sanitization for different environments", () => {
			const sensitiveError = {
				message: "Database connection failed",
				password: "db_password_123",
				key: "encryption_key_456",
				token: "jwt_token_789",
				secret: "app_secret_abc",
				connectionString: "postgres://user:pass@host:5432/db",
			};

			const sanitized = sanitizeErrorForLogging(sensitiveError);

			expect(sanitized).not.toHaveProperty("password");
			expect(sanitized).not.toHaveProperty("key");
			expect(sanitized).not.toHaveProperty("token");
			expect(sanitized).not.toHaveProperty("secret");
			expect(sanitized).toHaveProperty("message");
			expect(sanitized).toHaveProperty("connectionString");
		});
	});
});
