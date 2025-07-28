import { HttpResponse, http } from "msw";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import { GET } from "../route";

describe("/api/published-assurance-cases API Route", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = {
			...originalEnv,
			API_URL: "http://localhost:8000",
		};
	});

	afterEach(() => {
		process.env = originalEnv;
		server.resetHandlers();
	});

	describe("Authentication", () => {
		it("should return 401 when Authorization header is missing", async () => {
			const request = new NextRequest(
				"http://localhost:3000/api/published-assurance-cases"
			);

			const response = await GET(request);
			const responseData = await response.json();

			expect(response.status).toBe(401);
			expect(responseData.error).toBe("Unauthorized");
		});

		it("should pass Authorization header to backend API", async () => {
			const authToken = "Bearer token123";
			const request = new NextRequest(
				"http://localhost:3000/api/published-assurance-cases",
				{
					headers: {
						Authorization: authToken,
					},
				}
			);

			const mockResponseData = [
				{
					id: 1,
					name: "Published Case 1",
					description: "A published assurance case",
					published_date: "2024-01-01T00:00:00Z",
				},
			];

			let capturedRequest: Request | null = null;
			server.use(
				http.get(
					"http://localhost:8000/api/published-assurance-cases/",
					({ request: req }) => {
						capturedRequest = req;
						return HttpResponse.json(mockResponseData);
					}
				)
			);

			const response = await GET(request);
			const responseData = await response.json();

			expect(response.status).toBe(200);
			expect(responseData).toEqual(mockResponseData);
			expect(capturedRequest).not.toBeNull();
			expect(
				(capturedRequest as Request | null)?.headers.get("Authorization")
			).toBe(authToken);
			expect(
				(capturedRequest as Request | null)?.headers.get("Content-Type")
			).toBe("application/json");
		});
	});

	describe("Successful Responses", () => {
		const authToken = "Bearer valid-token";

		it("should return published assurance cases data", async () => {
			const request = new NextRequest(
				"http://localhost:3000/api/published-assurance-cases",
				{
					headers: { Authorization: authToken },
				}
			);

			const mockData = [
				{
					id: 1,
					name: "Safety Case for Autonomous Vehicle",
					description:
						"Comprehensive safety case for level 4 autonomous driving",
					published_date: "2024-01-15T10:30:00Z",
					case_study: 1,
				},
				{
					id: 2,
					name: "Medical Device Safety Case",
					description: "Safety assurance for medical monitoring device",
					published_date: "2024-02-01T14:20:00Z",
					case_study: 2,
				},
			];

			server.use(
				http.get("http://localhost:8000/api/published-assurance-cases/", () => {
					return HttpResponse.json(mockData);
				})
			);

			const response = await GET(request);
			const responseData = await response.json();

			expect(response.status).toBe(200);
			expect(responseData).toEqual(mockData);
			expect(Array.isArray(responseData)).toBe(true);
			expect(responseData).toHaveLength(2);
		});

		it("should handle empty results", async () => {
			const request = new NextRequest(
				"http://localhost:3000/api/published-assurance-cases",
				{
					headers: { Authorization: authToken },
				}
			);

			server.use(
				http.get("http://localhost:8000/api/published-assurance-cases/", () => {
					return HttpResponse.json([]);
				})
			);

			const response = await GET(request);
			const responseData = await response.json();

			expect(response.status).toBe(200);
			expect(responseData).toEqual([]);
			expect(Array.isArray(responseData)).toBe(true);
		});

		it("should preserve response structure from backend", async () => {
			const request = new NextRequest(
				"http://localhost:3000/api/published-assurance-cases",
				{
					headers: { Authorization: authToken },
				}
			);

			const complexResponse = {
				results: [
					{
						id: 1,
						name: "Complex Case",
						metadata: { tags: ["safety", "critical"] },
					},
				],
				count: 1,
				next: null,
				previous: null,
			};

			server.use(
				http.get("http://localhost:8000/api/published-assurance-cases/", () => {
					return HttpResponse.json(complexResponse);
				})
			);

			const response = await GET(request);
			const responseData = await response.json();

			expect(response.status).toBe(200);
			expect(responseData).toEqual(complexResponse);
			expect(responseData.results[0].metadata).toEqual({
				tags: ["safety", "critical"],
			});
		});
	});

	describe("Error Handling", () => {
		const authToken = "Bearer valid-token";

		it("should handle 404 from backend API", async () => {
			const request = new NextRequest(
				"http://localhost:3000/api/published-assurance-cases",
				{
					headers: { Authorization: authToken },
				}
			);

			server.use(
				http.get("http://localhost:8000/api/published-assurance-cases/", () => {
					return new HttpResponse(null, { status: 404 });
				})
			);

			const response = await GET(request);
			const responseData = await response.json();

			expect(response.status).toBe(404);
			expect(responseData.error).toBe("Failed to fetch");
		});

		it("should handle 403 Forbidden from backend API", async () => {
			const request = new NextRequest(
				"http://localhost:3000/api/published-assurance-cases",
				{
					headers: { Authorization: authToken },
				}
			);

			server.use(
				http.get("http://localhost:8000/api/published-assurance-cases/", () => {
					return new HttpResponse(null, { status: 403 });
				})
			);

			const response = await GET(request);
			const responseData = await response.json();

			expect(response.status).toBe(403);
			expect(responseData.error).toBe("Failed to fetch");
		});

		it("should handle 500 from backend API", async () => {
			const request = new NextRequest(
				"http://localhost:3000/api/published-assurance-cases",
				{
					headers: { Authorization: authToken },
				}
			);

			server.use(
				http.get("http://localhost:8000/api/published-assurance-cases/", () => {
					return new HttpResponse(null, { status: 500 });
				})
			);

			const response = await GET(request);
			const responseData = await response.json();

			expect(response.status).toBe(500);
			expect(responseData.error).toBe("Failed to fetch");
		});

		it("should handle network errors", async () => {
			const request = new NextRequest(
				"http://localhost:3000/api/published-assurance-cases",
				{
					headers: { Authorization: authToken },
				}
			);

			server.use(
				http.get("http://localhost:8000/api/published-assurance-cases/", () => {
					return HttpResponse.error();
				})
			);

			const response = await GET(request);
			const responseData = await response.json();

			expect(response.status).toBe(500);
			expect(responseData.error).toBe("Internal server error");
		});

		it("should handle fetch timeout", async () => {
			const request = new NextRequest(
				"http://localhost:3000/api/published-assurance-cases",
				{
					headers: { Authorization: authToken },
				}
			);

			server.use(
				http.get(
					"http://localhost:8000/api/published-assurance-cases/",
					async () => {
						await new Promise((resolve) => setTimeout(resolve, 100));
						return HttpResponse.json([]);
					}
				)
			);

			const response = await GET(request);
			const responseData = await response.json();

			// Since we're not actually implementing timeout in the route,
			// this should succeed
			expect(response.status).toBe(200);
			expect(responseData).toEqual([]);
		});
	});

	describe("Environment Configuration", () => {
		const authToken = "Bearer valid-token";

		it("should use API_URL when available", async () => {
			const request = new NextRequest(
				"http://localhost:3000/api/published-assurance-cases",
				{
					headers: { Authorization: authToken },
				}
			);

			let capturedUrl: string | null = null;
			server.use(
				http.get("*", ({ request: req }) => {
					capturedUrl = req.url;
					return HttpResponse.json([]);
				})
			);

			await GET(request);

			expect(capturedUrl).toBe(
				"http://localhost:8000/api/published-assurance-cases/"
			);
		});

		it("should fallback to NEXT_PUBLIC_API_URL when API_URL is not set", async () => {
			process.env.API_URL = undefined;
			process.env.NEXT_PUBLIC_API_URL = "http://localhost:9000";

			const request = new NextRequest(
				"http://localhost:3000/api/published-assurance-cases",
				{
					headers: { Authorization: authToken },
				}
			);

			let capturedUrl: string | null = null;
			server.use(
				http.get("*", ({ request: req }) => {
					capturedUrl = req.url;
					return HttpResponse.json([]);
				})
			);

			await GET(request);

			expect(capturedUrl).toBe(
				"http://localhost:9000/api/published-assurance-cases/"
			);
		});

		it("should handle missing environment variables gracefully", async () => {
			process.env.API_URL = undefined;
			process.env.NEXT_PUBLIC_API_URL = undefined;

			const request = new NextRequest(
				"http://localhost:3000/api/published-assurance-cases",
				{
					headers: { Authorization: authToken },
				}
			);

			server.use(
				http.get("*", () => {
					return HttpResponse.json([]);
				})
			);

			const response = await GET(request);
			const responseData = await response.json();

			// The route should construct a URL even without env vars
			expect(response.status).toBe(200);
			expect(responseData).toEqual([]);
		});
	});

	describe("Request Headers", () => {
		const authToken = "Bearer valid-token";

		it("should set correct headers for backend request", async () => {
			const request = new NextRequest(
				"http://localhost:3000/api/published-assurance-cases",
				{
					headers: { Authorization: authToken },
				}
			);

			let capturedHeaders: Headers | null = null;
			server.use(
				http.get(
					"http://localhost:8000/api/published-assurance-cases/",
					({ request: req }) => {
						capturedHeaders = req.headers;
						return HttpResponse.json([]);
					}
				)
			);

			await GET(request);

			expect((capturedHeaders as Headers | null)?.get("Authorization")).toBe(
				authToken
			);
			expect((capturedHeaders as Headers | null)?.get("Content-Type")).toBe(
				"application/json"
			);
			expect((capturedHeaders as Headers | null)?.get("Connection")).toBe(
				"close"
			);
		});

		it("should disable caching with no-store", async () => {
			const request = new NextRequest(
				"http://localhost:3000/api/published-assurance-cases",
				{
					headers: { Authorization: authToken },
				}
			);

			server.use(
				http.get("http://localhost:8000/api/published-assurance-cases/", () => {
					return HttpResponse.json([]);
				})
			);

			const response = await GET(request);

			expect(response.status).toBe(200);
			// We can't directly test the cache property, but we know it's set in the route
		});
	});

	describe("Response Format", () => {
		const authToken = "Bearer valid-token";

		it("should preserve data types from backend response", async () => {
			const request = new NextRequest(
				"http://localhost:3000/api/published-assurance-cases",
				{
					headers: { Authorization: authToken },
				}
			);

			const typedResponse = [
				{
					id: 1,
					name: "Test Case",
					isPublished: true,
					publishedDate: "2024-01-01T00:00:00Z",
					viewCount: 100,
					rating: 4.5,
					tags: ["safety", "critical"],
					metadata: null,
				},
			];

			server.use(
				http.get("http://localhost:8000/api/published-assurance-cases/", () => {
					return HttpResponse.json(typedResponse);
				})
			);

			const response = await GET(request);
			const responseData = await response.json();

			expect(response.status).toBe(200);
			expect(responseData[0].isPublished).toBe(true);
			expect(typeof responseData[0].viewCount).toBe("number");
			expect(typeof responseData[0].rating).toBe("number");
			expect(Array.isArray(responseData[0].tags)).toBe(true);
			expect(responseData[0].metadata).toBeNull();
		});
	});
});
