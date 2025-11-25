import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import { setupEnvVars } from "@/src/__tests__/utils/env-test-utils";
import { fetchCurrentUser } from "../users";

const mockApiUrl = "http://localhost:8000";

describe("Users Actions", () => {
	const mockToken = "test-token-123";
	let cleanupEnv: (() => void) | undefined;

	beforeEach(() => {
		// Set environment variables
		cleanupEnv = setupEnvVars({
			API_URL: mockApiUrl,
			NEXT_PUBLIC_API_URL: mockApiUrl,
		});
		vi.clearAllMocks();
	});

	afterEach(() => {
		if (cleanupEnv) {
			cleanupEnv();
		}
		server.resetHandlers();
		vi.clearAllMocks();
	});

	describe("fetchCurrentUser", () => {
		it("should fetch current user successfully", async () => {
			const mockUser = {
				id: 1,
				username: "testuser",
				email: "test@example.com",
				first_name: "Test",
				last_name: "User",
				auth_provider: "github",
				auth_username: "testuser",
				created_date: "2024-01-01T00:00:00Z",
			};

			server.use(
				http.get(`${mockApiUrl}/api/user/`, ({ request }) => {
					// Verify authorization header
					const authHeader = request.headers.get("Authorization");
					expect(authHeader).toBe(`Token ${mockToken}`);

					return HttpResponse.json(mockUser);
				})
			);

			const result = await fetchCurrentUser(mockToken);

			expect(result).toEqual(mockUser);
		});

		it("should return undefined when user is not found (404)", async () => {
			server.use(
				http.get(`${mockApiUrl}/api/user/`, () => {
					return new HttpResponse(null, { status: 404 });
				})
			);

			const result = await fetchCurrentUser(mockToken);

			expect(result).toBeUndefined();
		});

		it("should return undefined when user is forbidden (403)", async () => {
			server.use(
				http.get(`${mockApiUrl}/api/user/`, () => {
					return new HttpResponse(null, { status: 403 });
				})
			);

			const result = await fetchCurrentUser(mockToken);

			expect(result).toBeUndefined();
		});

		it("should return null when authentication fails (401)", async () => {
			server.use(
				http.get(`${mockApiUrl}/api/user/`, () => {
					return new HttpResponse(null, { status: 401 });
				})
			);

			const result = await fetchCurrentUser(mockToken);

			expect(result).toBeNull();
		});

		it("should return user when other HTTP errors occur", async () => {
			const mockErrorResponse = { error: "Internal server error" };

			server.use(
				http.get(`${mockApiUrl}/api/user/`, () => {
					return HttpResponse.json(mockErrorResponse, { status: 500 });
				})
			);

			const result = await fetchCurrentUser(mockToken);

			// The function only handles specific status codes, so other errors return the response
			expect(result).toEqual(mockErrorResponse);
		});

		it("should handle network errors gracefully", async () => {
			server.use(
				http.get(`${mockApiUrl}/api/user/`, () => {
					return HttpResponse.error();
				})
			);

			// Since the function doesn't have a try-catch, network errors will be thrown
			await expect(fetchCurrentUser(mockToken)).rejects.toThrow();
		});

		it("should set correct authorization header", async () => {
			let requestHeaders: Headers | undefined;

			server.use(
				http.get(`${mockApiUrl}/api/user/`, ({ request }) => {
					requestHeaders = request.headers;
					return HttpResponse.json({ id: 1, username: "test" });
				})
			);

			await fetchCurrentUser(mockToken);

			expect(requestHeaders?.get("Authorization")).toBe(`Token ${mockToken}`);
		});

		it("should handle empty token", async () => {
			server.use(
				http.get(`${mockApiUrl}/api/user/`, () => {
					// For empty token, server would typically return 401
					return new HttpResponse(null, { status: 401 });
				})
			);

			const result = await fetchCurrentUser("");

			expect(result).toBeNull();
		});

		it("should handle special characters in token", async () => {
			const specialToken = "token-with-special-chars!@#$%^&*()";

			server.use(
				http.get(`${mockApiUrl}/api/user/`, ({ request }) => {
					const authHeader = request.headers.get("Authorization");
					expect(authHeader).toBe(`Token ${specialToken}`);

					return HttpResponse.json({ id: 1, username: "test" });
				})
			);

			const result = await fetchCurrentUser(specialToken);

			expect(result).toBeDefined();
		});

		it("should handle long token strings", async () => {
			const longToken = "a".repeat(1000); // Very long token

			server.use(
				http.get(`${mockApiUrl}/api/user/`, ({ request }) => {
					const authHeader = request.headers.get("Authorization");
					expect(authHeader).toBe(`Token ${longToken}`);

					return HttpResponse.json({ id: 1, username: "test" });
				})
			);

			const result = await fetchCurrentUser(longToken);

			expect(result).toBeDefined();
		});

		it("should return user with minimal required fields", async () => {
			const minimalUser = {
				id: 999,
				username: "minimal",
			};

			server.use(
				http.get(`${mockApiUrl}/api/user/`, () => {
					return HttpResponse.json(minimalUser);
				})
			);

			const result = await fetchCurrentUser(mockToken);

			expect(result).toEqual(minimalUser);
		});

		it("should return user with additional fields", async () => {
			const extendedUser = {
				id: 1,
				username: "testuser",
				email: "test@example.com",
				first_name: "Test",
				last_name: "User",
				auth_provider: "github",
				auth_username: "testuser",
				profile_picture: "https://avatar.example.com/testuser",
				bio: "Test user biography",
				location: "Test City",
				website: "https://testuser.example.com",
				created_date: "2024-01-01T00:00:00Z",
				updated_date: "2024-01-15T00:00:00Z",
				last_login: "2024-01-20T12:00:00Z",
				is_active: true,
				is_verified: true,
				preferences: {
					theme: "dark",
					notifications: true,
				},
			};

			server.use(
				http.get(`${mockApiUrl}/api/user/`, () => {
					return HttpResponse.json(extendedUser);
				})
			);

			const result = await fetchCurrentUser(mockToken);

			expect(result).toEqual(extendedUser);
		});

		it("should handle malformed JSON response", async () => {
			server.use(
				http.get(`${mockApiUrl}/api/user/`, () => {
					return new HttpResponse("invalid json", {
						headers: { "Content-Type": "application/json" },
					});
				})
			);

			await expect(fetchCurrentUser(mockToken)).rejects.toThrow();
		});

		it("should handle response with null values", async () => {
			const userWithNulls = {
				id: 1,
				username: "testuser",
				email: null,
				first_name: null,
				last_name: null,
				auth_provider: "local",
				auth_username: null,
			};

			server.use(
				http.get(`${mockApiUrl}/api/user/`, () => {
					return HttpResponse.json(userWithNulls);
				})
			);

			const result = await fetchCurrentUser(mockToken);

			expect(result).toEqual(userWithNulls);
		});
	});

	describe("Environment variable handling", () => {
		it("should use API_URL when both API_URL and NEXT_PUBLIC_API_URL are set", async () => {
			const restoreEnv = setupEnvVars({
				API_URL: "http://priority.localhost:8000",
				NEXT_PUBLIC_API_URL: "http://secondary.localhost:8000",
			});

			let usedUrl = "";

			server.use(
				http.get("http://priority.localhost:8000/api/user/", ({ request }) => {
					usedUrl = request.url;
					return HttpResponse.json({ id: 1, username: "test" });
				})
			);

			await fetchCurrentUser(mockToken);

			expect(usedUrl).toContain("http://priority.localhost:8000");
			restoreEnv();
		});

		it("should use NEXT_PUBLIC_API_URL when API_URL is not set", async () => {
			const restoreEnv = setupEnvVars({
				API_URL: undefined,
				NEXT_PUBLIC_API_URL: "http://public.localhost:8000",
			});

			let usedUrl = "";

			server.use(
				http.get("http://public.localhost:8000/api/user/", ({ request }) => {
					usedUrl = request.url;
					return HttpResponse.json({ id: 1, username: "test" });
				})
			);

			await fetchCurrentUser(mockToken);

			expect(usedUrl).toContain("http://public.localhost:8000");
			restoreEnv();
		});

		it("should handle undefined environment variables gracefully", async () => {
			const restoreEnv = setupEnvVars({
				API_URL: undefined,
				NEXT_PUBLIC_API_URL: undefined,
			});

			// When both URLs are undefined, the function attempts to make a request to undefined
			// This returns undefined rather than throwing an error
			const result = await fetchCurrentUser(mockToken);

			// The result should be undefined since the request can't be made
			expect(result).toBeUndefined();
			restoreEnv();
		});
	});

	describe("HTTP status code edge cases", () => {
		it("should handle 200 OK status", async () => {
			const mockUser = { id: 1, username: "success" };

			server.use(
				http.get(`${mockApiUrl}/api/user/`, () => {
					return HttpResponse.json(mockUser, { status: 200 });
				})
			);

			const result = await fetchCurrentUser(mockToken);

			expect(result).toEqual(mockUser);
		});

		it("should handle 204 No Content status", async () => {
			server.use(
				http.get(`${mockApiUrl}/api/user/`, () => {
					return new HttpResponse("", { status: 204 });
				})
			);

			// 204 with empty body will cause JSON parsing error
			await expect(fetchCurrentUser(mockToken)).rejects.toThrow();
		});

		it("should handle 400 Bad Request status", async () => {
			const errorResponse = { error: "Bad request" };

			server.use(
				http.get(`${mockApiUrl}/api/user/`, () => {
					return HttpResponse.json(errorResponse, { status: 400 });
				})
			);

			const result = await fetchCurrentUser(mockToken);

			// 400 is not specifically handled, so it should return the response
			expect(result).toEqual(errorResponse);
		});

		it("should handle 422 Unprocessable Entity status", async () => {
			const validationError = {
				error: "Validation failed",
				details: ["Token format is invalid"],
			};

			server.use(
				http.get(`${mockApiUrl}/api/user/`, () => {
					return HttpResponse.json(validationError, { status: 422 });
				})
			);

			const result = await fetchCurrentUser(mockToken);

			// 422 is not specifically handled, so it should return the response
			expect(result).toEqual(validationError);
		});

		it("should handle 502 Bad Gateway status", async () => {
			const gatewayError = { error: "Bad gateway" };

			server.use(
				http.get(`${mockApiUrl}/api/user/`, () => {
					return HttpResponse.json(gatewayError, { status: 502 });
				})
			);

			const result = await fetchCurrentUser(mockToken);

			// 502 is not specifically handled, so it should return the response
			expect(result).toEqual(gatewayError);
		});
	});

	describe("Response format variations", () => {
		it("should handle user data with different field naming conventions", async () => {
			const userWithDifferentFields = {
				user_id: 1,
				user_name: "testuser",
				email_address: "test@example.com",
				display_name: "Test User",
				created_at: "2024-01-01T00:00:00Z",
			};

			server.use(
				http.get(`${mockApiUrl}/api/user/`, () => {
					return HttpResponse.json(userWithDifferentFields);
				})
			);

			const result = await fetchCurrentUser(mockToken);

			expect(result).toEqual(userWithDifferentFields);
		});

		it("should handle nested user data", async () => {
			const nestedUserData = {
				user: {
					id: 1,
					username: "testuser",
					profile: {
						email: "test@example.com",
						personal: {
							first_name: "Test",
							last_name: "User",
						},
					},
				},
				metadata: {
					last_login: "2024-01-01T00:00:00Z",
					permissions: ["read", "write"],
				},
			};

			server.use(
				http.get(`${mockApiUrl}/api/user/`, () => {
					return HttpResponse.json(nestedUserData);
				})
			);

			const result = await fetchCurrentUser(mockToken);

			expect(result).toEqual(nestedUserData);
		});

		it("should handle array response (edge case)", async () => {
			const arrayResponse = [
				{ id: 1, username: "user1" },
				{ id: 2, username: "user2" },
			];

			server.use(
				http.get(`${mockApiUrl}/api/user/`, () => {
					return HttpResponse.json(arrayResponse);
				})
			);

			const result = await fetchCurrentUser(mockToken);

			expect(result).toEqual(arrayResponse);
		});

		it("should handle empty object response", async () => {
			server.use(
				http.get(`${mockApiUrl}/api/user/`, () => {
					return HttpResponse.json({});
				})
			);

			const result = await fetchCurrentUser(mockToken);

			expect(result).toEqual({});
		});
	});

	describe("Request timeout and performance", () => {
		it("should handle slow server response", async () => {
			const mockUser = { id: 1, username: "slowuser" };

			server.use(
				http.get(`${mockApiUrl}/api/user/`, async () => {
					// Simulate slow response
					await new Promise((resolve) => setTimeout(resolve, 100));
					return HttpResponse.json(mockUser);
				})
			);

			const result = await fetchCurrentUser(mockToken);

			expect(result).toEqual(mockUser);
		});

		it("should handle request with custom headers", async () => {
			const allHeaders: Record<string, string> = {};

			server.use(
				http.get(`${mockApiUrl}/api/user/`, ({ request }) => {
					// Capture all headers
					request.headers.forEach((value, key) => {
						allHeaders[key] = value;
					});

					return HttpResponse.json({ id: 1, username: "test" });
				})
			);

			await fetchCurrentUser(mockToken);

			// Verify that only the expected headers are set
			expect(allHeaders.authorization).toBe(`Token ${mockToken}`);
			// The function doesn't set Content-Type or other headers for GET requests
		});
	});
});
