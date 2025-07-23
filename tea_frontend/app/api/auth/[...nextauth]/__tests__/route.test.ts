import type { NextAuthOptions } from "next-auth";
import { describe, expect, it, vi } from "vitest";

// Mock NextAuth to return a predictable handler
const mockHandler = vi.fn();
vi.mock("next-auth", () => ({
	default: vi.fn(() => mockHandler),
}));

// Mock auth options
vi.mock("@/lib/auth-options", () => ({
	authOptions: {
		secret: "test-secret",
		session: { strategy: "jwt" },
		providers: [],
		callbacks: {},
	} as NextAuthOptions,
}));

describe("/api/auth/[...nextauth] API Route", () => {
	describe("Route Exports", () => {
		it("should export GET and POST handlers", async () => {
			// Dynamic import to ensure mocks are applied
			const { GET, POST } = await import("../route");

			expect(typeof GET).toBe("function");
			expect(typeof POST).toBe("function");
			expect(GET).toBe(POST); // Both should be the same NextAuth handler
		});
	});

	describe("NextAuth Integration", () => {
		it("should properly configure NextAuth", async () => {
			const NextAuth = (await import("next-auth")).default;
			const { authOptions } = await import("@/lib/auth-options");

			// Import the route to trigger NextAuth initialization
			await import("../route");

			expect(NextAuth).toHaveBeenCalledWith(authOptions);
		});

		it("should handle HTTP requests through NextAuth handler", async () => {
			const { GET, POST } = await import("../route");

			// Create a mock request
			const mockRequest = new Request("http://localhost:3000/api/auth/signin", {
				method: "GET",
			});

			// Mock the handler response - use mockResolvedValue for multiple calls
			const mockResponse = new Response(JSON.stringify({ ok: true }), {
				status: 200,
			});
			mockHandler.mockResolvedValue(mockResponse);

			// Test GET
			const response = await GET(mockRequest);
			expect(response).toBe(mockResponse);

			// Test POST with the same handler
			const postResponse = await POST(mockRequest);
			expect(postResponse).toBe(mockResponse);
		});

		it("should pass through NextAuth responses", async () => {
			const { GET } = await import("../route");

			const mockRequest = new Request(
				"http://localhost:3000/api/auth/session",
				{
					method: "GET",
				}
			);

			const mockResponse = new Response(
				JSON.stringify({ session: { user: { name: "Test User" } } }),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				}
			);

			mockHandler.mockResolvedValueOnce(mockResponse);

			const response = await GET(mockRequest);

			expect(response.status).toBe(200);
			expect(response.headers.get("Content-Type")).toBe("application/json");

			const data = await response.json();
			expect(data).toEqual({ session: { user: { name: "Test User" } } });
		});

		it("should handle authentication errors", async () => {
			const { POST } = await import("../route");

			const mockRequest = new Request("http://localhost:3000/api/auth/signin", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username: "invalid", password: "invalid" }),
			});

			const errorResponse = new Response(
				JSON.stringify({ error: "Invalid credentials" }),
				{ status: 401 }
			);

			mockHandler.mockResolvedValueOnce(errorResponse);

			const response = await POST(mockRequest);

			expect(response.status).toBe(401);
			const data = await response.json();
			expect(data.error).toBe("Invalid credentials");
		});

		it("should handle NextAuth callback routes", async () => {
			const { GET } = await import("../route");

			const mockRequest = new Request(
				"http://localhost:3000/api/auth/callback/github",
				{ method: "GET" }
			);

			const redirectResponse = new Response(null, {
				status: 302,
				headers: { Location: "/dashboard" },
			});

			mockHandler.mockResolvedValueOnce(redirectResponse);

			const response = await GET(mockRequest);

			expect(response.status).toBe(302);
			expect(response.headers.get("Location")).toBe("/dashboard");
		});

		it("should handle CSRF protection", async () => {
			const { POST } = await import("../route");

			const mockRequest = new Request("http://localhost:3000/api/auth/signin", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					csrfToken: "invalid-token",
					username: "user",
					password: "pass",
				}),
			});

			const csrfErrorResponse = new Response(
				JSON.stringify({ error: "CSRF token mismatch" }),
				{ status: 400 }
			);

			mockHandler.mockResolvedValueOnce(csrfErrorResponse);

			const response = await POST(mockRequest);

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.error).toBe("CSRF token mismatch");
		});
	});

	describe("Error Handling", () => {
		it("should handle NextAuth handler errors", async () => {
			const { GET } = await import("../route");

			const mockRequest = new Request("http://localhost:3000/api/auth/session");

			mockHandler.mockRejectedValueOnce(new Error("Internal server error"));

			await expect(GET(mockRequest)).rejects.toThrow("Internal server error");
		});
	});

	describe("Configuration Validation", () => {
		it("should use correct auth options structure", async () => {
			const { authOptions } = await import("@/lib/auth-options");

			expect(authOptions).toHaveProperty("secret");
			expect(authOptions).toHaveProperty("session");
			expect(authOptions).toHaveProperty("providers");
			expect(authOptions).toHaveProperty("callbacks");

			expect(authOptions.session).toHaveProperty("strategy", "jwt");
			expect(Array.isArray(authOptions.providers)).toBe(true);
			expect(typeof authOptions.callbacks).toBe("object");
		});

		it("should verify NextAuth was called during import", async () => {
			const NextAuth = (await import("next-auth")).default;

			// The route should have been imported in previous tests, triggering NextAuth
			expect(NextAuth).toHaveBeenCalled();
		});
	});
});
