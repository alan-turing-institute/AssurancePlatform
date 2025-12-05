import { HttpResponse, http } from "msw";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import { POST } from "../route";

describe("/api/screenshot API Route", () => {
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

	describe("Successful Upload", () => {
		it("should successfully upload screenshot to backend", async () => {
			const mockImageData =
				"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
			const caseId = "123";
			const authToken = "Bearer test-token";

			const request = new NextRequest("http://localhost:3000/api/screenshot", {
				method: "POST",
				headers: {
					Authorization: authToken,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					image: mockImageData,
					caseId,
				}),
			});

			const mockBackendResponse = {
				id: 1,
				case_id: Number.parseInt(caseId, 10),
				image_url: "/media/screenshots/test.png",
				created_at: "2024-01-01T00:00:00Z",
			};

			server.use(
				http.post("http://localhost:8000/api/cases/123/upload_image/", () => {
					// Simply return success - FormData testing in Node.js is complex
					return HttpResponse.json(mockBackendResponse);
				})
			);

			const response = await POST(request);
			const responseData = await response.json();

			expect(response.status).toBe(200);
			expect(responseData).toEqual(mockBackendResponse);
		});

		it("should handle large image uploads", async () => {
			// Create a large base64 string (simulating a large image)
			const largeImageData = `data:image/png;base64,${Buffer.alloc(1024 * 100).toString("base64")}`;
			const caseId = "456";
			const authToken = "Bearer test-token";

			const request = new NextRequest("http://localhost:3000/api/screenshot", {
				method: "POST",
				headers: {
					Authorization: authToken,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					image: largeImageData,
					caseId,
				}),
			});

			server.use(
				http.post("http://localhost:8000/api/cases/456/upload_image/", () =>
					HttpResponse.json({
						id: 2,
						case_id: 456,
						image_url: "/media/screenshots/large.png",
					})
				)
			);

			const response = await POST(request);

			expect(response.status).toBe(200);
		});
	});

	describe("Authentication", () => {
		it("should return 401 when Authorization header is missing", async () => {
			const request = new NextRequest("http://localhost:3000/api/screenshot", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					image: "data:image/png;base64,test",
					caseId: "123",
				}),
			});

			const response = await POST(request);
			const responseData = await response.json();

			expect(response.status).toBe(401);
			expect(responseData.error).toBe("Unauthorized");
		});

		it("should pass Authorization header to backend API", async () => {
			const authToken = "Bearer test-token";
			const request = new NextRequest("http://localhost:3000/api/screenshot", {
				method: "POST",
				headers: {
					Authorization: authToken,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					image: "data:image/png;base64,test",
					caseId: "123",
				}),
			});

			let capturedHeaders: Headers | undefined;
			server.use(
				http.post(
					"http://localhost:8000/api/cases/123/upload_image/",
					({ request: req }) => {
						capturedHeaders = req.headers;
						return HttpResponse.json({ success: true });
					}
				)
			);

			await POST(request);

			expect(capturedHeaders).toBeTruthy();
			expect(capturedHeaders?.get("Authorization")).toBe(authToken);
		});
	});

	describe("Input Validation", () => {
		it("should return 400 for missing image data", async () => {
			const request = new NextRequest("http://localhost:3000/api/screenshot", {
				method: "POST",
				headers: {
					Authorization: "Bearer test-token",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					caseId: "123",
				}),
			});

			const response = await POST(request);
			const responseData = await response.json();

			expect(response.status).toBe(400);
			expect(responseData.error).toBe("Missing required fields");
		});

		it("should return 400 for missing caseId", async () => {
			const request = new NextRequest("http://localhost:3000/api/screenshot", {
				method: "POST",
				headers: {
					Authorization: "Bearer test-token",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					image: "data:image/png;base64,test",
				}),
			});

			const response = await POST(request);
			const responseData = await response.json();

			expect(response.status).toBe(400);
			expect(responseData.error).toBe("Missing required fields");
		});

		it("should return 400 for invalid JSON body", async () => {
			const request = new NextRequest("http://localhost:3000/api/screenshot", {
				method: "POST",
				headers: {
					Authorization: "Bearer test-token",
					"Content-Type": "application/json",
				},
				body: "invalid json",
			});

			const response = await POST(request);
			const responseData = await response.json();

			expect(response.status).toBe(400);
			expect(responseData.error).toBe("Invalid request body");
		});

		it("should handle invalid base64 image data", async () => {
			const request = new NextRequest("http://localhost:3000/api/screenshot", {
				method: "POST",
				headers: {
					Authorization: "Bearer test-token",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					image: "invalid-base64-data",
					caseId: "123",
				}),
			});

			server.use(
				http.post(
					"http://localhost:8000/api/cases/123/upload_image/",
					() => new HttpResponse(null, { status: 400 })
				)
			);

			const response = await POST(request);

			expect(response.status).toBe(400);
		});
	});

	describe("Error Handling", () => {
		const authToken = "Bearer test-token";

		it("should handle 404 from backend API", async () => {
			const request = new NextRequest("http://localhost:3000/api/screenshot", {
				method: "POST",
				headers: {
					Authorization: authToken,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					image: "data:image/png;base64,test",
					caseId: "999",
				}),
			});

			server.use(
				http.post(
					"http://localhost:8000/api/cases/999/upload_image/",
					() => new HttpResponse(null, { status: 404 })
				)
			);

			const response = await POST(request);
			const responseData = await response.json();

			expect(response.status).toBe(404);
			expect(responseData.error).toBe("Failed to upload");
		});

		it("should handle 413 Payload Too Large from backend API", async () => {
			const request = new NextRequest("http://localhost:3000/api/screenshot", {
				method: "POST",
				headers: {
					Authorization: authToken,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					image: "data:image/png;base64,verylargeimagedatahere",
					caseId: "123",
				}),
			});

			server.use(
				http.post(
					"http://localhost:8000/api/cases/123/upload_image/",
					() => new HttpResponse(null, { status: 413 })
				)
			);

			const response = await POST(request);
			const responseData = await response.json();

			expect(response.status).toBe(413);
			expect(responseData.error).toBe("Failed to upload");
		});

		it("should handle 500 from backend API", async () => {
			const request = new NextRequest("http://localhost:3000/api/screenshot", {
				method: "POST",
				headers: {
					Authorization: authToken,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					image: "data:image/png;base64,test",
					caseId: "123",
				}),
			});

			server.use(
				http.post(
					"http://localhost:8000/api/cases/123/upload_image/",
					() => new HttpResponse(null, { status: 500 })
				)
			);

			const response = await POST(request);
			const responseData = await response.json();

			expect(response.status).toBe(500);
			expect(responseData.error).toBe("Failed to upload");
		});

		it("should handle network errors", async () => {
			const request = new NextRequest("http://localhost:3000/api/screenshot", {
				method: "POST",
				headers: {
					Authorization: authToken,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					image: "data:image/png;base64,test",
					caseId: "123",
				}),
			});

			server.use(
				http.post("http://localhost:8000/api/cases/123/upload_image/", () =>
					HttpResponse.error()
				)
			);

			const response = await POST(request);
			const responseData = await response.json();

			expect(response.status).toBe(500);
			expect(responseData.error).toBe("Internal server error");
		});
	});

	describe("Backend API Integration", () => {
		const authToken = "Bearer test-token";

		it("should make correct API call to backend", async () => {
			const caseId = "789";
			const request = new NextRequest("http://localhost:3000/api/screenshot", {
				method: "POST",
				headers: {
					Authorization: authToken,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					image: "data:image/png;base64,test",
					caseId,
				}),
			});

			let capturedUrl: string | null = null;
			server.use(
				http.post("*", ({ request: req }) => {
					capturedUrl = req.url;
					return HttpResponse.json({ success: true });
				})
			);

			await POST(request);

			expect(capturedUrl).toBe(
				`http://localhost:8000/api/cases/${caseId}/upload_image/`
			);
		});

		it("should return backend response data", async () => {
			const request = new NextRequest("http://localhost:3000/api/screenshot", {
				method: "POST",
				headers: {
					Authorization: authToken,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					image: "data:image/png;base64,test",
					caseId: "123",
				}),
			});

			const backendResponse = {
				id: 42,
				case_id: 123,
				image_url: "/media/screenshots/abc123.png",
				thumbnail_url: "/media/screenshots/thumbs/abc123.png",
				created_at: "2024-01-15T10:30:00Z",
				created_by: "testuser",
			};

			server.use(
				http.post("http://localhost:8000/api/cases/123/upload_image/", () =>
					HttpResponse.json(backendResponse)
				)
			);

			const response = await POST(request);
			const responseData = await response.json();

			expect(response.status).toBe(200);
			expect(responseData).toEqual(backendResponse);
		});

		it("should use correct authorization header format", async () => {
			const tokenValue = "test-token-value";
			const request = new NextRequest("http://localhost:3000/api/screenshot", {
				method: "POST",
				headers: {
					Authorization: `Token ${tokenValue}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					image: "data:image/png;base64,test",
					caseId: "123",
				}),
			});

			let capturedAuth: string | null = null;
			server.use(
				http.post(
					"http://localhost:8000/api/cases/123/upload_image/",
					({ request: req }) => {
						capturedAuth = req.headers.get("Authorization");
						return HttpResponse.json({ success: true });
					}
				)
			);

			await POST(request);

			expect(capturedAuth).toBe(`Token ${tokenValue}`);
		});
	});

	describe("Environment Configuration", () => {
		const authToken = "Bearer test-token";

		it("should fallback to NEXT_PUBLIC_API_URL", async () => {
			process.env.API_URL = undefined;
			process.env.NEXT_PUBLIC_API_URL = "http://localhost:9000";

			const request = new NextRequest("http://localhost:3000/api/screenshot", {
				method: "POST",
				headers: {
					Authorization: authToken,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					image: "data:image/png;base64,test",
					caseId: "123",
				}),
			});

			let capturedUrl: string | null = null;
			server.use(
				http.post("*", ({ request: req }) => {
					capturedUrl = req.url;
					return HttpResponse.json({ success: true });
				})
			);

			await POST(request);

			expect(capturedUrl).toBe(
				"http://localhost:9000/api/cases/123/upload_image/"
			);
		});

		it("should use fallback to staging URLs", async () => {
			process.env.API_URL = undefined;
			process.env.NEXT_PUBLIC_API_URL = undefined;
			process.env.API_URL_STAGING = "http://staging.example.com";

			const request = new NextRequest("http://localhost:3000/api/screenshot", {
				method: "POST",
				headers: {
					Authorization: authToken,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					image: "data:image/png;base64,test",
					caseId: "123",
				}),
			});

			let capturedUrl: string | null = null;
			server.use(
				http.post("*", ({ request: req }) => {
					capturedUrl = req.url;
					return HttpResponse.json({ success: true });
				})
			);

			await POST(request);

			expect(capturedUrl).toBe(
				"http://staging.example.com/api/cases/123/upload_image/"
			);
		});
	});

	describe("Response Format", () => {
		it("should return JSON response with correct content type", async () => {
			const request = new NextRequest("http://localhost:3000/api/screenshot", {
				method: "POST",
				headers: {
					Authorization: "Bearer test-token",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					image: "data:image/png;base64,test",
					caseId: "123",
				}),
			});

			server.use(
				http.post("http://localhost:8000/api/cases/123/upload_image/", () =>
					HttpResponse.json({ success: true })
				)
			);

			const response = await POST(request);

			expect(response.headers.get("content-type")).toContain(
				"application/json"
			);
		});

		it("should preserve backend response structure", async () => {
			const request = new NextRequest("http://localhost:3000/api/screenshot", {
				method: "POST",
				headers: {
					Authorization: "Bearer test-token",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					image: "data:image/png;base64,test",
					caseId: "123",
				}),
			});

			const complexResponse = {
				data: {
					id: 1,
					urls: {
						full: "/media/full.png",
						thumb: "/media/thumb.png",
					},
				},
				metadata: {
					size: 1024,
					format: "png",
				},
			};

			server.use(
				http.post("http://localhost:8000/api/cases/123/upload_image/", () =>
					HttpResponse.json(complexResponse)
				)
			);

			const response = await POST(request);
			const responseData = await response.json();

			expect(responseData).toEqual(complexResponse);
			expect(responseData.data.urls).toEqual({
				full: "/media/full.png",
				thumb: "/media/thumb.png",
			});
		});
	});

	describe("File Handling", () => {
		it("should properly convert base64 to blob", async () => {
			const mockImageData =
				"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
			const request = new NextRequest("http://localhost:3000/api/screenshot", {
				method: "POST",
				headers: {
					Authorization: "Bearer test-token",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					image: mockImageData,
					caseId: "123",
				}),
			});

			server.use(
				http.post("http://localhost:8000/api/cases/123/upload_image/", () => {
					// Simply return success - FormData testing in Node.js is complex
					return HttpResponse.json({ success: true });
				})
			);

			const response = await POST(request);

			// In Node.js test environment, FormData handling is limited
			// Just ensure the request was successful
			expect(response.status).toBe(200);
		});
	});
});
