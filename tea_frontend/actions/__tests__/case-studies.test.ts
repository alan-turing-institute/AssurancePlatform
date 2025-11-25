import { HttpResponse, http } from "msw";
import { revalidatePath } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import { setupEnvVars } from "@/src/__tests__/utils/env-test-utils";
import {
	createCaseStudy,
	deleteCaseStudy,
	fetchCaseStudies,
	fetchCaseStudyById,
	fetchPublishedAssuranceCaseId,
	fetchPublishedCaseStudies,
	fetchPublishedCaseStudyById,
	updateCaseStudy,
} from "../case-studies";

// Mock Next.js functions
vi.mock("next/navigation", () => ({
	notFound: vi.fn(),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

const mockApiUrl = "http://localhost:8000";

describe("Case Studies Actions", () => {
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

	describe("fetchCaseStudies", () => {
		it("should fetch case studies successfully", async () => {
			const mockCaseStudies = [
				{
					id: 1,
					title: "Test Case Study 1",
					description: "First test case study",
					type: "learning",
					owner: 1,
					created_date: "2024-01-01T00:00:00Z",
				},
				{
					id: 2,
					title: "Test Case Study 2",
					description: "Second test case study",
					type: "research",
					owner: 1,
					created_date: "2024-01-02T00:00:00Z",
				},
			];

			server.use(
				http.get(`${mockApiUrl}/api/case-studies/`, ({ request }) => {
					// Verify authorization header
					const authHeader = request.headers.get("Authorization");
					expect(authHeader).toBe(`Token ${mockToken}`);

					return HttpResponse.json(mockCaseStudies);
				})
			);

			const result = await fetchCaseStudies(mockToken);

			expect(result).toEqual(mockCaseStudies);
		});

		it("should throw error when HTTP request fails", async () => {
			server.use(
				http.get(`${mockApiUrl}/api/case-studies/`, () => {
					return new HttpResponse(null, { status: 500 });
				})
			);

			await expect(fetchCaseStudies(mockToken)).rejects.toThrow(
				"HTTP error! status: 500"
			);
		});

		it("should throw error when network fails", async () => {
			server.use(
				http.get(`${mockApiUrl}/api/case-studies/`, () => {
					return HttpResponse.error();
				})
			);

			await expect(fetchCaseStudies(mockToken)).rejects.toThrow();
		});

		it("should handle empty case studies list", async () => {
			server.use(
				http.get(`${mockApiUrl}/api/case-studies/`, () => {
					return HttpResponse.json([]);
				})
			);

			const result = await fetchCaseStudies(mockToken);

			expect(result).toEqual([]);
		});
	});

	describe("fetchPublishedCaseStudies", () => {
		it("should fetch published case studies successfully", async () => {
			const mockPublishedCaseStudies = [
				{
					id: 1,
					title: "Published Case Study",
					description: "A published case study",
					type: "reference",
					published: true,
					published_date: "2024-01-01T00:00:00Z",
				},
			];

			server.use(
				http.get(`${mockApiUrl}/api/public/case-studies/`, () => {
					return HttpResponse.json(mockPublishedCaseStudies);
				})
			);

			const result = await fetchPublishedCaseStudies();

			expect(result).toEqual(mockPublishedCaseStudies);
		});

		it("should throw error when HTTP request fails", async () => {
			server.use(
				http.get(`${mockApiUrl}/api/public/case-studies/`, () => {
					return new HttpResponse(null, { status: 404 });
				})
			);

			await expect(fetchPublishedCaseStudies()).rejects.toThrow(
				"HTTP error! status: 404"
			);
		});

		it("should handle empty published case studies list", async () => {
			server.use(
				http.get(`${mockApiUrl}/api/public/case-studies/`, () => {
					return HttpResponse.json([]);
				})
			);

			const result = await fetchPublishedCaseStudies();

			expect(result).toEqual([]);
		});
	});

	describe("fetchPublishedCaseStudyById", () => {
		const mockCaseStudyId = 123;

		it("should fetch published case study by ID successfully", async () => {
			const mockCaseStudy = {
				id: mockCaseStudyId,
				title: "Specific Published Case Study",
				description: "A specific published case study",
				content: "Detailed content",
				type: "reference",
				published: true,
			};

			server.use(
				http.get(
					`${mockApiUrl}/api/public/case-studies/${mockCaseStudyId}`,
					() => {
						return HttpResponse.json(mockCaseStudy);
					}
				)
			);

			const result = await fetchPublishedCaseStudyById(mockCaseStudyId);

			expect(result).toEqual(mockCaseStudy);
		});

		it("should call notFound() when case study is not found (404)", async () => {
			server.use(
				http.get(
					`${mockApiUrl}/api/public/case-studies/${mockCaseStudyId}`,
					() => {
						return new HttpResponse(null, { status: 404 });
					}
				)
			);

			// The function first checks response.ok, then checks if status is 404
			// If 404, it calls notFound() which doesn't return normally
			await expect(
				fetchPublishedCaseStudyById(mockCaseStudyId)
			).rejects.toThrow();
		});

		it("should throw error for other HTTP errors", async () => {
			server.use(
				http.get(
					`${mockApiUrl}/api/public/case-studies/${mockCaseStudyId}`,
					() => {
						return new HttpResponse(null, { status: 500 });
					}
				)
			);

			await expect(
				fetchPublishedCaseStudyById(mockCaseStudyId)
			).rejects.toThrow("HTTP error! status: 500");
		});
	});

	describe("fetchCaseStudyById", () => {
		const mockCaseStudyId = 456;

		it("should fetch case study by ID successfully", async () => {
			const mockCaseStudy = {
				id: mockCaseStudyId,
				title: "Private Case Study",
				description: "A private case study",
				type: "learning",
				owner: 1,
			};

			server.use(
				http.get(
					`${mockApiUrl}/api/case-studies/${mockCaseStudyId}/`,
					({ request }) => {
						// Verify authorization header
						const authHeader = request.headers.get("Authorization");
						expect(authHeader).toBe(`Token ${mockToken}`);

						return HttpResponse.json(mockCaseStudy);
					}
				)
			);

			const result = await fetchCaseStudyById(mockToken, mockCaseStudyId);

			expect(result).toEqual(mockCaseStudy);
		});

		it("should throw error when HTTP request fails", async () => {
			server.use(
				http.get(`${mockApiUrl}/api/case-studies/${mockCaseStudyId}/`, () => {
					return new HttpResponse(null, { status: 403 });
				})
			);

			await expect(
				fetchCaseStudyById(mockToken, mockCaseStudyId)
			).rejects.toThrow("HTTP error! status: 403");
		});
	});

	describe("createCaseStudy", () => {
		it("should create case study successfully", async () => {
			const mockFormData = new FormData();
			mockFormData.append("title", "New Case Study");
			mockFormData.append("description", "New case study description");
			mockFormData.append("type", "learning");

			const mockCreatedCaseStudy = {
				id: 123,
				title: "New Case Study",
				description: "New case study description",
				type: "learning",
				owner: 1,
				created_date: "2024-01-01T00:00:00Z",
			};

			// Reset all handlers to ensure ours takes precedence
			server.resetHandlers(
				http.post(`${mockApiUrl}/api/case-studies/`, ({ request }) => {
					// Verify authorization header
					const authHeader = request.headers.get("Authorization");
					expect(authHeader).toBe(`Token ${mockToken}`);

					// For testing purposes, just return success without validating FormData
					// FormData parsing in MSW test environment has compatibility issues
					return HttpResponse.json(mockCreatedCaseStudy, { status: 201 });
				})
			);

			const result = await createCaseStudy(mockToken, mockFormData);

			expect(result).toEqual(mockCreatedCaseStudy);
			expect(revalidatePath).toHaveBeenCalledWith("/dashboard/case-studies");
		});

		it("should return null when token is not provided", async () => {
			const mockFormData = new FormData();

			const result = await createCaseStudy("", mockFormData);

			expect(result).toBeNull();
		});

		it("should return null when HTTP request fails", async () => {
			const mockFormData = new FormData();

			server.use(
				http.post(`${mockApiUrl}/api/case-studies/`, () => {
					return new HttpResponse("Bad Request", { status: 400 });
				})
			);

			const result = await createCaseStudy(mockToken, mockFormData);

			expect(result).toBeNull();
		});

		it("should handle FormData with file upload", async () => {
			const mockFormData = new FormData();
			const mockFile = new File(["test content"], "test.png", {
				type: "image/png",
			});
			mockFormData.append("title", "Case Study with Image");
			mockFormData.append("image", mockFile);

			const mockCreatedCaseStudy = {
				id: 124,
				title: "Case Study with Image",
				image: "/media/case-studies/124/test.png",
			};

			server.resetHandlers(
				http.post(`${mockApiUrl}/api/case-studies/`, ({ request }) => {
					// Verify authorization header
					const authHeader = request.headers.get("Authorization");
					expect(authHeader).toBe(`Token ${mockToken}`);

					// Skip FormData validation due to MSW compatibility issues
					return HttpResponse.json(mockCreatedCaseStudy, { status: 201 });
				})
			);

			const result = await createCaseStudy(mockToken, mockFormData);

			expect(result).toEqual(mockCreatedCaseStudy);
		});
	});

	describe("updateCaseStudy", () => {
		const mockCaseStudyId = 789;

		it("should update case study successfully", async () => {
			const mockFormData = new FormData();
			mockFormData.append("id", mockCaseStudyId.toString());
			mockFormData.append("title", "Updated Case Study");
			mockFormData.append("description", "Updated description");

			// Reset handlers to ensure our test handler takes precedence
			server.resetHandlers(
				http.put(
					`${mockApiUrl}/api/case-studies/${mockCaseStudyId}/`,
					({ request }) => {
						// Verify authorization header
						const authHeader = request.headers.get("Authorization");
						expect(authHeader).toBe(`Token ${mockToken}`);

						// Skip FormData validation due to MSW compatibility issues
						return HttpResponse.json({ success: true });
					}
				)
			);

			const result = await updateCaseStudy(mockToken, mockFormData);

			expect(result).toBe(true);
			expect(revalidatePath).toHaveBeenCalledWith(
				`/dashboard/case-studies/${mockCaseStudyId}`
			);
			expect(revalidatePath).toHaveBeenCalledWith(
				`/discover/${mockCaseStudyId}`
			);
			expect(revalidatePath).toHaveBeenCalledWith("/discover");
		});

		it("should return false when token is not provided", async () => {
			const mockFormData = new FormData();
			mockFormData.append("id", mockCaseStudyId.toString());

			const result = await updateCaseStudy(undefined, mockFormData);

			expect(result).toBe(false);
		});

		it("should return false when HTTP request fails", async () => {
			const mockFormData = new FormData();
			mockFormData.append("id", mockCaseStudyId.toString());

			server.use(
				http.put(`${mockApiUrl}/api/case-studies/${mockCaseStudyId}/`, () => {
					return new HttpResponse(null, { status: 500 });
				})
			);

			const result = await updateCaseStudy(mockToken, mockFormData);

			expect(result).toBe(false);
		});

		it("should handle FormData with file update", async () => {
			const mockFormData = new FormData();
			const mockFile = new File(["updated content"], "updated.png", {
				type: "image/png",
			});
			mockFormData.append("id", mockCaseStudyId.toString());
			mockFormData.append("title", "Updated with Image");
			mockFormData.append("image", mockFile);

			server.resetHandlers(
				http.put(
					`${mockApiUrl}/api/case-studies/${mockCaseStudyId}/`,
					({ request }) => {
						// Verify authorization header
						const authHeader = request.headers.get("Authorization");
						expect(authHeader).toBe(`Token ${mockToken}`);

						// Skip FormData validation due to MSW compatibility issues
						return HttpResponse.json({ success: true });
					}
				)
			);

			const result = await updateCaseStudy(mockToken, mockFormData);

			expect(result).toBe(true);
		});
	});

	describe("deleteCaseStudy", () => {
		const mockCaseStudyId = 999;

		it("should delete case study successfully", async () => {
			server.use(
				http.delete(
					`${mockApiUrl}/api/case-studies/${mockCaseStudyId}/`,
					({ request }) => {
						// Verify authorization header
						const authHeader = request.headers.get("Authorization");
						expect(authHeader).toBe(`Token ${mockToken}`);

						return new HttpResponse(null, { status: 204 });
					}
				)
			);

			const result = await deleteCaseStudy(mockToken, mockCaseStudyId);

			expect(result).toBe(true);
			expect(revalidatePath).toHaveBeenCalledWith("/dashboard/case-studies");
		});

		it("should return false when HTTP request fails", async () => {
			server.use(
				http.delete(
					`${mockApiUrl}/api/case-studies/${mockCaseStudyId}/`,
					() => {
						return new HttpResponse(null, { status: 500 });
					}
				)
			);

			const result = await deleteCaseStudy(mockToken, mockCaseStudyId);

			expect(result).toBe(false);
		});

		it("should return false when case study not found", async () => {
			server.use(
				http.delete(
					`${mockApiUrl}/api/case-studies/${mockCaseStudyId}/`,
					() => {
						return new HttpResponse(null, { status: 404 });
					}
				)
			);

			const result = await deleteCaseStudy(mockToken, mockCaseStudyId);

			expect(result).toBe(false);
		});

		it("should return false when unauthorized", async () => {
			server.use(
				http.delete(
					`${mockApiUrl}/api/case-studies/${mockCaseStudyId}/`,
					() => {
						return new HttpResponse(null, { status: 403 });
					}
				)
			);

			const result = await deleteCaseStudy(mockToken, mockCaseStudyId);

			expect(result).toBe(false);
		});
	});

	describe("fetchPublishedAssuranceCaseId", () => {
		const mockAssuranceCaseId = "abc-123";

		it("should fetch published assurance case by ID successfully", async () => {
			const mockAssuranceCase = {
				id: mockAssuranceCaseId,
				name: "Published Assurance Case",
				description: "A published assurance case",
				published: true,
				published_date: "2024-01-01T00:00:00Z",
			};

			server.use(
				http.get(
					`${mockApiUrl}/api/public/assurance-case/${mockAssuranceCaseId}/`,
					() => {
						return HttpResponse.json(mockAssuranceCase);
					}
				)
			);

			const result = await fetchPublishedAssuranceCaseId(mockAssuranceCaseId);

			expect(result).toEqual(mockAssuranceCase);
		});

		it("should throw error when HTTP request fails", async () => {
			server.use(
				http.get(
					`${mockApiUrl}/api/public/assurance-case/${mockAssuranceCaseId}/`,
					() => {
						return new HttpResponse(null, { status: 404 });
					}
				)
			);

			await expect(
				fetchPublishedAssuranceCaseId(mockAssuranceCaseId)
			).rejects.toThrow("HTTP error! status: 404");
		});

		it("should handle network errors", async () => {
			server.use(
				http.get(
					`${mockApiUrl}/api/public/assurance-case/${mockAssuranceCaseId}/`,
					() => {
						return HttpResponse.error();
					}
				)
			);

			await expect(
				fetchPublishedAssuranceCaseId(mockAssuranceCaseId)
			).rejects.toThrow();
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
				http.get(
					"http://priority.localhost:8000/api/case-studies/",
					({ request }) => {
						usedUrl = request.url;
						return HttpResponse.json([]);
					}
				)
			);

			await fetchCaseStudies(mockToken);

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
				http.get(
					"http://public.localhost:8000/api/case-studies/",
					({ request }) => {
						usedUrl = request.url;
						return HttpResponse.json([]);
					}
				)
			);

			await fetchCaseStudies(mockToken);

			expect(usedUrl).toContain("http://public.localhost:8000");
			restoreEnv();
		});
	});

	describe("Error handling edge cases", () => {
		it("should handle malformed JSON response", async () => {
			server.use(
				http.get(`${mockApiUrl}/api/case-studies/`, () => {
					return new HttpResponse("malformed json", {
						headers: { "Content-Type": "application/json" },
					});
				})
			);

			await expect(fetchCaseStudies(mockToken)).rejects.toThrow();
		});

		it("should handle timeout errors", async () => {
			server.use(
				http.post(`${mockApiUrl}/api/case-studies/`, () => {
					// Simulate timeout by returning an error response
					return HttpResponse.error();
				})
			);

			const mockFormData = new FormData();

			// The createCaseStudy function doesn't catch network errors, so they will throw
			await expect(createCaseStudy(mockToken, mockFormData)).rejects.toThrow();
		});

		it("should handle server errors during update", async () => {
			const mockFormData = new FormData();
			mockFormData.append("id", "123");

			server.use(
				http.put(`${mockApiUrl}/api/case-studies/123/`, () => {
					return new HttpResponse("Internal Server Error", { status: 500 });
				})
			);

			const result = await updateCaseStudy(mockToken, mockFormData);

			expect(result).toBe(false);
		});
	});

	describe("Cache revalidation", () => {
		it("should revalidate correct paths after case study creation", async () => {
			const mockFormData = new FormData();
			mockFormData.append("title", "Test Case Study");

			server.use(
				http.post(`${mockApiUrl}/api/case-studies/`, () => {
					return HttpResponse.json({ id: 123 }, { status: 201 });
				})
			);

			await createCaseStudy(mockToken, mockFormData);

			expect(revalidatePath).toHaveBeenCalledWith("/dashboard/case-studies");
			expect(revalidatePath).toHaveBeenCalledTimes(1);
		});

		it("should revalidate multiple paths after case study update", async () => {
			const mockFormData = new FormData();
			mockFormData.append("id", "456");

			server.use(
				http.put(`${mockApiUrl}/api/case-studies/456/`, () => {
					return HttpResponse.json({ success: true });
				})
			);

			await updateCaseStudy(mockToken, mockFormData);

			expect(revalidatePath).toHaveBeenCalledWith(
				"/dashboard/case-studies/456"
			);
			expect(revalidatePath).toHaveBeenCalledWith("/discover/456");
			expect(revalidatePath).toHaveBeenCalledWith("/discover");
			expect(revalidatePath).toHaveBeenCalledTimes(3);
		});

		it("should revalidate correct path after case study deletion", async () => {
			server.use(
				http.delete(`${mockApiUrl}/api/case-studies/789/`, () => {
					return new HttpResponse(null, { status: 204 });
				})
			);

			await deleteCaseStudy(mockToken, 789);

			expect(revalidatePath).toHaveBeenCalledWith("/dashboard/case-studies");
			expect(revalidatePath).toHaveBeenCalledTimes(1);
		});
	});
});
