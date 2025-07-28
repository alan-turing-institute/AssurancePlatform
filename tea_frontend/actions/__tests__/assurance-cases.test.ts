import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import { HttpResponse, http } from "msw";
import {
	fetchAssuranceCases,
	fetchSharedAssuranceCases,
	fetchPublishedAssuranceCases,
} from "../assurance-cases";

// Mock environment variables
const mockApiUrl = "http://localhost:8000";

describe("Assurance Cases Actions", () => {
	const mockToken = "test-token-123";

	beforeEach(() => {
		// Set environment variables
		process.env.API_URL = mockApiUrl;
		process.env.NEXT_PUBLIC_API_URL = mockApiUrl;
		// Clear any staging URLs to test primary URL fallback
		delete process.env.API_URL_STAGING;
		delete process.env.NEXT_PUBLIC_API_URL_STAGING;
	});

	afterEach(() => {
		server.resetHandlers();
		vi.clearAllMocks();
	});

	describe("fetchAssuranceCases", () => {
		it("should fetch owned assurance cases successfully", async () => {
			const mockCases = [
				{
					id: 1,
					name: "Test Case 1",
					description: "First test case",
					owner: 1,
					permissions: "manage",
				},
				{
					id: 2,
					name: "Test Case 2",
					description: "Second test case",
					owner: 1,
					permissions: "manage",
				},
			];

			server.use(
				http.get(`${mockApiUrl}/api/cases`, ({ request }) => {
					const url = new URL(request.url);
					const owner = url.searchParams.get("owner");
					const view = url.searchParams.get("view");
					const edit = url.searchParams.get("edit");
					const review = url.searchParams.get("review");

					// Verify correct query parameters
					expect(owner).toBe("true");
					expect(view).toBe("false");
					expect(edit).toBe("false");
					expect(review).toBe("false");

					// Verify authorization header
					const authHeader = request.headers.get("Authorization");
					expect(authHeader).toBe(`Token ${mockToken}`);

					return HttpResponse.json(mockCases);
				})
			);

			const result = await fetchAssuranceCases(mockToken);

			expect(result).toEqual(mockCases);
		});

		it("should return null when authentication fails (401)", async () => {
			server.use(
				http.get(`${mockApiUrl}/api/cases`, () => {
					return new HttpResponse(null, { status: 401 });
				})
			);

			const result = await fetchAssuranceCases(mockToken);

			expect(result).toBeNull();
		});

		it("should return null when network error occurs", async () => {
			server.use(
				http.get(`${mockApiUrl}/api/cases`, () => {
					return HttpResponse.error();
				})
			);

			const result = await fetchAssuranceCases(mockToken);

			expect(result).toBeNull();
		});

		it("should use staging URL when primary URL is not available", async () => {
			// Clear primary URLs and set staging URLs
			delete process.env.API_URL;
			delete process.env.NEXT_PUBLIC_API_URL;
			process.env.API_URL_STAGING = "http://staging.localhost:8000";
			process.env.NEXT_PUBLIC_API_URL_STAGING = "http://staging.localhost:8000";

			const mockCases = [{ id: 1, name: "Staging Case" }];

			server.use(
				http.get("http://staging.localhost:8000/api/cases", () => {
					return HttpResponse.json(mockCases);
				})
			);

			const result = await fetchAssuranceCases(mockToken);

			expect(result).toEqual(mockCases);
		});

		it("should handle empty response", async () => {
			server.use(
				http.get(`${mockApiUrl}/api/cases`, () => {
					return HttpResponse.json([]);
				})
			);

			const result = await fetchAssuranceCases(mockToken);

			expect(result).toEqual([]);
		});

		it("should set correct headers", async () => {
			let requestHeaders: Headers | null = null;

			server.use(
				http.get(`${mockApiUrl}/api/cases`, ({ request }) => {
					requestHeaders = request.headers;
					return HttpResponse.json([]);
				})
			);

			await fetchAssuranceCases(mockToken);

			expect(requestHeaders?.get("Content-Type")).toBe("application/json");
			expect(requestHeaders?.get("Authorization")).toBe(`Token ${mockToken}`);
		});
	});

	describe("fetchSharedAssuranceCases", () => {
		it("should fetch shared assurance cases successfully", async () => {
			const mockSharedCases = [
				{
					id: 3,
					name: "Shared Case 1",
					description: "Case shared with me",
					owner: 2,
					permissions: "edit",
				},
			];

			server.use(
				http.get(`${mockApiUrl}/api/cases`, ({ request }) => {
					const url = new URL(request.url);
					const owner = url.searchParams.get("owner");
					const view = url.searchParams.get("view");
					const edit = url.searchParams.get("edit");

					// Verify correct query parameters for shared cases
					expect(owner).toBe("false");
					expect(view).toBe("true");
					expect(edit).toBe("true");

					return HttpResponse.json(mockSharedCases);
				})
			);

			const result = await fetchSharedAssuranceCases(mockToken);

			expect(result).toEqual(mockSharedCases);
		});

		it("should return null when authentication fails (401)", async () => {
			server.use(
				http.get(`${mockApiUrl}/api/cases`, () => {
					return new HttpResponse(null, { status: 401 });
				})
			);

			const result = await fetchSharedAssuranceCases(mockToken);

			expect(result).toBeNull();
		});

		it("should return null when network error occurs", async () => {
			server.use(
				http.get(`${mockApiUrl}/api/cases`, () => {
					return HttpResponse.error();
				})
			);

			const result = await fetchSharedAssuranceCases(mockToken);

			expect(result).toBeNull();
		});

		it("should handle non-401 HTTP errors gracefully", async () => {
			server.use(
				http.get(`${mockApiUrl}/api/cases`, () => {
					return new HttpResponse(null, { status: 500 });
				})
			);

			const result = await fetchSharedAssuranceCases(mockToken);

			// Should return the response even for 500 errors (not handled specifically)
			expect(result).toBeDefined();
		});

		it("should use staging URL when primary URL is not available", async () => {
			// Clear primary URLs and set staging URLs
			delete process.env.API_URL;
			delete process.env.NEXT_PUBLIC_API_URL;
			process.env.API_URL_STAGING = "http://staging.localhost:8000";
			process.env.NEXT_PUBLIC_API_URL_STAGING = "http://staging.localhost:8000";

			const mockCases = [{ id: 1, name: "Staging Shared Case" }];

			server.use(
				http.get("http://staging.localhost:8000/api/cases", () => {
					return HttpResponse.json(mockCases);
				})
			);

			const result = await fetchSharedAssuranceCases(mockToken);

			expect(result).toEqual(mockCases);
		});
	});

	describe("fetchPublishedAssuranceCases", () => {
		it("should fetch published assurance cases successfully", async () => {
			const mockPublishedCases = [
				{
					id: 1,
					name: "Published Safety Case",
					description: "A published case for public viewing",
					published_date: "2024-01-01T00:00:00Z",
					owner: 1,
					owner_name: "Test User",
				},
				{
					id: 2,
					name: "Another Published Case",
					description: "Another published case",
					published_date: "2024-01-02T00:00:00Z",
					owner: 2,
					owner_name: "Another User",
				},
			];

			server.use(
				http.get(`${mockApiUrl}/api/published-assurance-cases/`, () => {
					return HttpResponse.json(mockPublishedCases);
				})
			);

			const result = await fetchPublishedAssuranceCases(mockToken);

			expect(result).toEqual(mockPublishedCases);
		});

		it("should return null when authentication fails (401)", async () => {
			server.use(
				http.get(`${mockApiUrl}/api/published-assurance-cases/`, () => {
					return new HttpResponse(null, { status: 401 });
				})
			);

			const result = await fetchPublishedAssuranceCases(mockToken);

			expect(result).toBeNull();
		});

		it("should return null when network error occurs", async () => {
			server.use(
				http.get(`${mockApiUrl}/api/published-assurance-cases/`, () => {
					return HttpResponse.error();
				})
			);

			const result = await fetchPublishedAssuranceCases(mockToken);

			expect(result).toBeNull();
		});

		it("should handle empty published cases list", async () => {
			server.use(
				http.get(`${mockApiUrl}/api/published-assurance-cases/`, () => {
					return HttpResponse.json([]);
				})
			);

			const result = await fetchPublishedAssuranceCases(mockToken);

			expect(result).toEqual([]);
		});

		it("should use staging URL when primary URL is not available", async () => {
			// Clear primary URLs and set staging URLs
			delete process.env.API_URL;
			delete process.env.NEXT_PUBLIC_API_URL;
			process.env.API_URL_STAGING = "http://staging.localhost:8000";
			process.env.NEXT_PUBLIC_API_URL_STAGING = "http://staging.localhost:8000";

			const mockCases = [
				{
					id: 1,
					name: "Staging Published Case",
					published_date: "2024-01-01T00:00:00Z",
				},
			];

			server.use(
				http.get("http://staging.localhost:8000/api/published-assurance-cases/", () => {
					return HttpResponse.json(mockCases);
				})
			);

			const result = await fetchPublishedAssuranceCases(mockToken);

			expect(result).toEqual(mockCases);
		});

		it("should handle malformed JSON response", async () => {
			server.use(
				http.get(`${mockApiUrl}/api/published-assurance-cases/`, () => {
					return new HttpResponse("invalid json", {
						headers: { "Content-Type": "application/json" },
					});
				})
			);

			const result = await fetchPublishedAssuranceCases(mockToken);

			expect(result).toBeNull();
		});
	});

	describe("API URL fallback logic", () => {
		it("should prioritize API_URL over NEXT_PUBLIC_API_URL", async () => {
			process.env.API_URL = "http://priority.localhost:8000";
			process.env.NEXT_PUBLIC_API_URL = "http://secondary.localhost:8000";

			let usedUrl = "";

			server.use(
				http.get("http://priority.localhost:8000/api/cases", ({ request }) => {
					usedUrl = request.url;
					return HttpResponse.json([]);
				})
			);

			await fetchAssuranceCases(mockToken);

			expect(usedUrl).toContain("http://priority.localhost:8000");
		});

		it("should fall back to staging URLs when primary URLs are undefined", async () => {
			delete process.env.API_URL;
			delete process.env.NEXT_PUBLIC_API_URL;
			process.env.API_URL_STAGING = "http://staging1.localhost:8000";
			process.env.NEXT_PUBLIC_API_URL_STAGING = "http://staging2.localhost:8000";

			let usedUrl = "";

			server.use(
				http.get("http://staging1.localhost:8000/api/cases", ({ request }) => {
					usedUrl = request.url;
					return HttpResponse.json([]);
				})
			);

			await fetchAssuranceCases(mockToken);

			expect(usedUrl).toContain("http://staging1.localhost:8000");
		});
	});

	describe("Error handling edge cases", () => {
		it("should handle timeout errors", async () => {
			server.use(
				http.get(`${mockApiUrl}/api/cases`, async () => {
					// Simulate timeout
					await new Promise(resolve => setTimeout(resolve, 100));
					return HttpResponse.error();
				})
			);

			const result = await fetchAssuranceCases(mockToken);

			expect(result).toBeNull();
		});

		it("should handle 404 responses by returning the response", async () => {
			const notFoundResponse = { error: "Not found" };

			server.use(
				http.get(`${mockApiUrl}/api/published-assurance-cases/`, () => {
					return HttpResponse.json(notFoundResponse, { status: 404 });
				})
			);

			const result = await fetchPublishedAssuranceCases(mockToken);

			expect(result).toEqual(notFoundResponse);
		});

		it("should handle responses with missing fields", async () => {
			const incompleteCases = [
				{ id: 1 }, // Missing required fields
				{ id: 2, name: "Partial Case" }, // Missing some fields
			];

			server.use(
				http.get(`${mockApiUrl}/api/cases`, () => {
					return HttpResponse.json(incompleteCases);
				})
			);

			const result = await fetchAssuranceCases(mockToken);

			expect(result).toEqual(incompleteCases);
		});
	});
});
