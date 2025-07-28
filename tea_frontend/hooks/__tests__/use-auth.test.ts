import { renderHook } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
	useEnforceLogin,
	useEnforceLogout,
	useLoginToken,
} from "@/hooks/use-auth";

// Mock window.location
const mockReplace = vi.fn();

// Mock localStorage
const localStorageMock = {
	getItem: vi.fn(),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn(),
};

// Set up window mocks before tests
beforeAll(() => {
	Object.defineProperty(window, "location", {
		value: { replace: mockReplace },
		writable: true,
		configurable: true,
	});

	Object.defineProperty(window, "localStorage", {
		value: localStorageMock,
		writable: true,
		configurable: true,
	});
});

describe("useAuth hooks", () => {
	beforeEach(() => {
		// Clear all mocks before each test
		vi.clearAllMocks();
		mockReplace.mockClear();
		localStorageMock.getItem.mockReset();
		localStorageMock.setItem.mockReset();
		localStorageMock.clear.mockReset();
		localStorageMock.getItem.mockReturnValue(null);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("useEnforceLogin", () => {
		it("should redirect to home when token is null", () => {
			localStorageMock.getItem.mockReturnValue(null);

			const { result } = renderHook(() => useEnforceLogin());

			expect(mockReplace).toHaveBeenCalledWith("/");
			expect(result.current).toBe(false);
		});

		it("should redirect to home when token is undefined", () => {
			localStorageMock.getItem.mockReturnValue(undefined);

			const { result } = renderHook(() => useEnforceLogin());

			expect(mockReplace).toHaveBeenCalledWith("/");
			expect(result.current).toBe(false);
		});

		it("should not redirect when token exists", () => {
			localStorageMock.getItem.mockReturnValue("valid-token");

			const { result } = renderHook(() => useEnforceLogin());

			expect(mockReplace).not.toHaveBeenCalled();
			expect(result.current).toBe(true);
		});

		it("should return true when user is authenticated", () => {
			localStorageMock.getItem.mockReturnValue("user-token-123");

			const { result } = renderHook(() => useEnforceLogin());

			expect(result.current).toBe(true);
			expect(mockReplace).not.toHaveBeenCalled();
		});

		it("should handle window check in useLoginToken", () => {
			// Verify window is defined in test environment
			expect(typeof window).toBe("object");
			expect(window.localStorage).toBeDefined();
		});
	});

	describe("useEnforceLogout", () => {
		it("should redirect to home when token exists", () => {
			localStorageMock.getItem.mockReturnValue("some-token");

			const { result } = renderHook(() => useEnforceLogout());

			expect(mockReplace).toHaveBeenCalledWith("/");
			expect(result.current).toBe(false);
		});

		it("should not redirect when token is null", () => {
			localStorageMock.getItem.mockReturnValue(null);

			const { result } = renderHook(() => useEnforceLogout());

			expect(mockReplace).not.toHaveBeenCalled();
			expect(result.current).toBe(true);
		});

		it("should not redirect when token is undefined", () => {
			localStorageMock.getItem.mockReturnValue(undefined);

			const { result } = renderHook(() => useEnforceLogout());

			expect(mockReplace).not.toHaveBeenCalled();
			expect(result.current).toBe(true);
		});

		it("should return true when user is not authenticated", () => {
			localStorageMock.getItem.mockReturnValue(null);

			const { result } = renderHook(() => useEnforceLogout());

			expect(result.current).toBe(true);
			expect(mockReplace).not.toHaveBeenCalled();
		});
	});

	describe("useLoginToken", () => {
		describe("getting token", () => {
			it("should get token from localStorage", () => {
				const testToken = "test-token-123";
				localStorageMock.getItem.mockReturnValue(testToken);

				const { result } = renderHook(() => useLoginToken());
				const [token] = result.current;

				expect(localStorageMock.getItem).toHaveBeenCalledWith("token");
				expect(token).toBe(testToken);
			});

			it("should return null when no token exists", () => {
				localStorageMock.getItem.mockReturnValue(null);

				const { result } = renderHook(() => useLoginToken());
				const [token] = result.current;

				expect(token).toBeNull();
			});
		});

		describe("setting token", () => {
			it("should set token to localStorage", () => {
				const { result } = renderHook(() => useLoginToken());
				const [, setToken] = result.current;

				const newToken = "new-token-456";
				setToken(newToken);

				expect(localStorageMock.clear).toHaveBeenCalled();
				expect(localStorageMock.setItem).toHaveBeenCalledWith(
					"token",
					newToken
				);
			});

			it("should clear localStorage when setting null", () => {
				const { result } = renderHook(() => useLoginToken());
				const [, setToken] = result.current;

				setToken(null);

				expect(localStorageMock.clear).toHaveBeenCalled();
				expect(localStorageMock.setItem).not.toHaveBeenCalled();
			});

			it("should clear localStorage before setting new token", () => {
				localStorageMock.getItem.mockReturnValue("old-token");

				const { result } = renderHook(() => useLoginToken());
				const [, setToken] = result.current;

				setToken("new-token");

				expect(localStorageMock.clear).toHaveBeenCalledTimes(1);
				expect(localStorageMock.setItem).toHaveBeenCalledWith(
					"token",
					"new-token"
				);
			});

			it("should return null from setToken function", () => {
				const { result } = renderHook(() => useLoginToken());
				const [, setToken] = result.current;

				const returnValue = setToken("any-token");

				expect(returnValue).toBeNull();
			});
		});

		describe("hook behavior", () => {
			it("should return a tuple with token and setToken function", () => {
				const { result } = renderHook(() => useLoginToken());

				expect(result.current).toHaveLength(2);
				expect(typeof result.current[0]).toBe("object"); // null is typeof object
				expect(typeof result.current[1]).toBe("function");
			});

			it("should maintain the same setToken reference across re-renders", () => {
				const { result, rerender } = renderHook(() => useLoginToken());
				const [, setToken1] = result.current;

				rerender();
				const [, setToken2] = result.current;

				expect(setToken1).toBe(setToken2);
			});

			it("should reflect token changes immediately", () => {
				localStorageMock.getItem.mockReturnValue("initial-token");

				const { result, rerender } = renderHook(() => useLoginToken());
				const [initialToken] = result.current;

				expect(initialToken).toBe("initial-token");

				// Simulate token change in localStorage
				localStorageMock.getItem.mockReturnValue("updated-token");
				rerender();

				const [updatedToken] = result.current;
				expect(updatedToken).toBe("updated-token");
			});
		});

		describe("edge cases", () => {
			it("should handle empty string token", () => {
				const { result } = renderHook(() => useLoginToken());
				const [, setToken] = result.current;

				setToken("");

				expect(localStorageMock.clear).toHaveBeenCalled();
				// Empty string is falsy, so setItem should not be called
				expect(localStorageMock.setItem).not.toHaveBeenCalled();
			});

			it("should handle whitespace-only token", () => {
				const { result } = renderHook(() => useLoginToken());
				const [, setToken] = result.current;

				setToken("   ");

				expect(localStorageMock.clear).toHaveBeenCalled();
				expect(localStorageMock.setItem).toHaveBeenCalledWith("token", "   ");
			});

			it("should handle very long tokens", () => {
				const longToken = "a".repeat(10_000);
				const { result } = renderHook(() => useLoginToken());
				const [, setToken] = result.current;

				setToken(longToken);

				expect(localStorageMock.setItem).toHaveBeenCalledWith(
					"token",
					longToken
				);
			});

			it("should handle special characters in token", () => {
				const specialToken = '!@#$%^&*()_+-=[]{}|;:"<>?,./~`';
				const { result } = renderHook(() => useLoginToken());
				const [, setToken] = result.current;

				setToken(specialToken);

				expect(localStorageMock.setItem).toHaveBeenCalledWith(
					"token",
					specialToken
				);
			});
		});
	});

	describe("integration scenarios", () => {
		it("should work correctly when useEnforceLogin is called with valid token", () => {
			localStorageMock.getItem.mockReturnValue("valid-session-token");

			const { result: tokenResult } = renderHook(() => useLoginToken());
			const { result: enforceResult } = renderHook(() => useEnforceLogin());

			const [token] = tokenResult.current;
			expect(token).toBe("valid-session-token");
			expect(enforceResult.current).toBe(true);
			expect(mockReplace).not.toHaveBeenCalled();
		});

		it("should work correctly when useEnforceLogout is called without token", () => {
			localStorageMock.getItem.mockReturnValue(null);

			const { result: tokenResult } = renderHook(() => useLoginToken());
			const { result: enforceResult } = renderHook(() => useEnforceLogout());

			const [token] = tokenResult.current;
			expect(token).toBeNull();
			expect(enforceResult.current).toBe(true);
			expect(mockReplace).not.toHaveBeenCalled();
		});

		it("should handle login flow correctly", () => {
			// Initially no token
			localStorageMock.getItem.mockReturnValue(null);

			const { result: tokenResult } = renderHook(() => useLoginToken());
			const [initialToken, setToken] = tokenResult.current;

			expect(initialToken).toBeNull();

			// User logs in
			setToken("user-login-token");

			expect(localStorageMock.clear).toHaveBeenCalled();
			expect(localStorageMock.setItem).toHaveBeenCalledWith(
				"token",
				"user-login-token"
			);
		});

		it("should handle logout flow correctly", () => {
			// Initially has token
			localStorageMock.getItem.mockReturnValue("existing-token");

			const { result: tokenResult } = renderHook(() => useLoginToken());
			const [initialToken, setToken] = tokenResult.current;

			expect(initialToken).toBe("existing-token");

			// User logs out
			setToken(null);

			expect(localStorageMock.clear).toHaveBeenCalled();
			expect(localStorageMock.setItem).not.toHaveBeenCalled();
		});
	});
});
