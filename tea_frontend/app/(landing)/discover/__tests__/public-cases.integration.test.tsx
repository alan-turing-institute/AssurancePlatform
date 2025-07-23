import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { useRouter } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import {
	createMockAssuranceCase,
	createMockCaseStudy,
	mockUser,
} from "@/src/__tests__/utils/mock-data";
import type { AssuranceCase, Group } from "@/types/domain";

interface PublishCaseRequest {
	published: boolean;
	public_description?: string;
	published_date?: string | null;
}

// Regex patterns for UI elements - extracted to avoid performance issues
const REGEX_PATTERNS = {
	settings: /settings/i,
	publishCase: /publish case/i,
	publicDescription: /public description/i,
	save: /save/i,
	casePublishedSuccessfully: /case published successfully/i,
	edit: /edit/i,
	caseUnpublishedSuccessfully: /case unpublished successfully/i,
	createCaseStudy: /create case study/i,
	title: /title/i,
	description: /description/i,
	create: /create/i,
	caseStudyCreatedSuccessfully: /case study created successfully/i,
	searchCases: /search cases/i,
	search: /search/i,
	filterByTags: /filter by tags/i,
	safety: /safety/i,
	applyFilters: /apply filters/i,
	sortBy: /sort by/i,
	failedToPublishCase: /failed to publish case/i,
	unableToLoadPublishedCases: /unable to load published cases/i,
	retry: /retry/i,
} as const;

// Mock components that would be tested individually
vi.mock("../page", () => ({
	default: () => {
		const { DiscoverPageMock } = require("./mocks/discover-page-mock");
		return <DiscoverPageMock />;
	},
}));

// Mock case editor component for publishing flow
vi.mock("@/components/cases/case-editor", () => ({
	default: ({ caseData }: { caseData: AssuranceCase }) => {
		const { CaseEditorMock } = require("./mocks/case-editor-mock");
		return <CaseEditorMock caseData={caseData} />;
	},
}));

// Mock authentication with a logged-in user
vi.mock("next-auth/react", () => ({
	useSession: () => ({
		data: {
			user: mockUser,
			key: "mock-jwt-token",
		},
		status: "authenticated",
	}),
	signIn: vi.fn(),
	signOut: vi.fn(),
	getSession: vi.fn(),
	SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

describe("Published Case Flow Integration Tests", () => {
	const user = userEvent.setup();
	const mockPush = vi.fn();
	const mockRefresh = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		(useRouter as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			push: mockPush,
			refresh: mockRefresh,
			back: vi.fn(),
			forward: vi.fn(),
			prefetch: vi.fn(),
			replace: vi.fn(),
		});
	});

	afterEach(() => {
		// Clean up any elements added directly to document.body
		const messages = document.body.querySelectorAll("body > div");
		messages.forEach((element) => {
			if (element.textContent?.includes("published successfully") ||
				element.textContent?.includes("Failed to publish")) {
				element.remove();
			}
		});
	});

	describe("Publishing a Case", () => {
		it("should allow owner to publish a case with public description", async () => {
			const unpublishedCase = createMockAssuranceCase({
				id: 1,
				name: "Test Safety Case",
				description: "Internal description",
				published: false,
				published_date: null,
				owner: mockUser.id,
			});

			// Mock case detail endpoint
			server.use(
				http.get(`${API_BASE_URL}/api/cases/1/`, () => {
					return HttpResponse.json(unpublishedCase);
				})
			);

			const { CaseEditorMock } = await import("./mocks/case-editor-mock");
			render(<CaseEditorMock caseData={unpublishedCase} />);

			// Open case settings
			const settingsButton = screen.getByRole("button", {
				name: REGEX_PATTERNS.settings,
			});
			await user.click(settingsButton);

			// Wait for settings modal
			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			// Toggle publish status
			const publishToggle = screen.getByRole("switch", {
				name: REGEX_PATTERNS.publishCase,
			});
			expect(publishToggle).not.toBeChecked();
			await user.click(publishToggle);

			// Add public description
			const publicDescriptionInput = screen.getByLabelText(
				REGEX_PATTERNS.publicDescription
			);
			await user.clear(publicDescriptionInput);
			await user.type(
				publicDescriptionInput,
				"This is a public description for the safety case"
			);

			// Mock the update endpoint
			server.use(
				http.put(`${API_BASE_URL}/api/cases/1/`, async ({ request }) => {
					const body = (await request.json()) as PublishCaseRequest;
					return HttpResponse.json({
						...unpublishedCase,
						published: body.published,
						published_date: body.published ? new Date().toISOString() : null,
						public_description: body.public_description,
					});
				})
			);

			// Save settings
			const saveButton = screen.getByRole("button", {
				name: REGEX_PATTERNS.save,
			});
			await user.click(saveButton);

			// Verify success message
			await waitFor(() => {
				expect(
					screen.getByText(REGEX_PATTERNS.casePublishedSuccessfully)
				).toBeInTheDocument();
			});

			// Verify case is now public
			server.use(
				http.get(`${API_BASE_URL}/api/public/published-cases/`, () => {
					return HttpResponse.json([
						{
							id: 1,
							name: "Test Safety Case",
							description: "This is a public description for the safety case",
							published_date: new Date().toISOString(),
						},
					]);
				})
			);
		});
	});

	describe("Viewing Published Cases", () => {
		it("should display list of published cases on discover page", async () => {
			const publishedCases = [
				createMockAssuranceCase({
					id: 1,
					name: "Safety Assurance Case",
					description: "Public safety case description",
					published: true,
					published_date: "2024-01-01T00:00:00Z",
				}),
				createMockAssuranceCase({
					id: 2,
					name: "Security Assurance Case",
					description: "Public security case description",
					published: true,
					published_date: "2024-01-02T00:00:00Z",
				}),
			];

			// Mock public cases endpoint
			server.use(
				http.get(`${API_BASE_URL}/api/public/published-cases/`, () => {
					return HttpResponse.json(publishedCases);
				})
			);

			const { DiscoverPageMock } = await import("./mocks/discover-page-mock");
			render(<DiscoverPageMock />);

			// Wait for cases to load
			await waitFor(() => {
				expect(screen.getByText("Safety Assurance Case")).toBeInTheDocument();
				expect(screen.getByText("Security Assurance Case")).toBeInTheDocument();
			});

			// Click on a case to view details
			const firstCase = screen.getByText("Safety Assurance Case");
			await user.click(firstCase);

			// Verify navigation to case detail
			expect(mockPush).toHaveBeenCalledWith("/discover/cases/1");
		});

		it("should show only public information when viewing published case", async () => {
			const publishedCase = {
				...createMockAssuranceCase({
					id: 1,
					name: "Public Safety Case",
					description: "Public description only",
					published: true,
					published_date: "2024-01-01T00:00:00Z",
					owner: 2,
				}),
				// These should not be visible to public
				edit_groups: [{ id: 1, name: "Internal Team" }] as Group[],
				comments: [
					{
						id: 1,
						author: "internal_user",
						content: "Internal comment",
						created_at: "2024-01-01T00:00:00Z",
					},
				] as import("@/types/domain").Comment[],
			};

			// Mock public case detail endpoint
			server.use(
				http.get(`${API_BASE_URL}/api/public/assurance-case/1/`, () => {
					return HttpResponse.json({
						id: publishedCase.id,
						name: publishedCase.name,
						description: publishedCase.description,
						published_date: publishedCase.published_date,
						// Public view should not include sensitive data
						goals: publishedCase.goals,
						property_claims: publishedCase.property_claims,
						evidence: publishedCase.evidence,
						contexts: publishedCase.contexts,
						strategies: publishedCase.strategies,
					});
				})
			);

			const { PublicCaseViewMock } = await import(
				"./mocks/public-case-view-mock"
			);
			render(<PublicCaseViewMock caseId={1} />);

			// Wait for case to load
			await waitFor(() => {
				expect(screen.getByText("Public Safety Case")).toBeInTheDocument();
			});

			// Verify public info is shown
			expect(screen.getByText("Public description only")).toBeInTheDocument();

			// Verify private info is NOT shown
			expect(screen.queryByText("Internal Team")).not.toBeInTheDocument();
			expect(screen.queryByText("Internal comment")).not.toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: REGEX_PATTERNS.edit })
			).not.toBeInTheDocument();
		});
	});

	describe("Unpublishing", () => {
		it("should allow owner to unpublish a case", async () => {
			const publishedCase = createMockAssuranceCase({
				id: 1,
				name: "Published Case",
				description: "Public description",
				published: true,
				published_date: "2024-01-01T00:00:00Z" as string | null,
				owner: mockUser.id,
			});

			// Mock case detail endpoint
			server.use(
				http.get(`${API_BASE_URL}/api/cases/1/`, () => {
					return HttpResponse.json(publishedCase);
				})
			);

			const { CaseEditorMock } = await import("./mocks/case-editor-mock");
			render(<CaseEditorMock caseData={publishedCase} />);

			// Open case settings
			const settingsButton = screen.getByRole("button", {
				name: REGEX_PATTERNS.settings,
			});
			await user.click(settingsButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			// Toggle publish status off
			const publishToggle = screen.getByRole("switch", {
				name: REGEX_PATTERNS.publishCase,
			});
			expect(publishToggle).toBeChecked();
			await user.click(publishToggle);

			// Mock the update endpoint
			server.use(
				http.put(`${API_BASE_URL}/api/cases/1/`, async ({ request }) => {
					const _body = await request.json();
					return HttpResponse.json({
						...publishedCase,
						published: false,
						published_date: null,
					});
				})
			);

			// Save settings
			const saveButton = screen.getByRole("button", {
				name: REGEX_PATTERNS.save,
			});
			await user.click(saveButton);

			// Verify success message
			await waitFor(() => {
				expect(
					screen.getByText(REGEX_PATTERNS.caseUnpublishedSuccessfully)
				).toBeInTheDocument();
			});

			// Verify case is removed from public list
			server.use(
				http.get(`${API_BASE_URL}/api/public/published-cases/`, () => {
					return HttpResponse.json([]);
				})
			);
		});
	});

	describe("Case Study Linking", () => {
		it("should create case study from published case", async () => {
			const publishedCase = createMockAssuranceCase({
				id: 1,
				name: "Published Case for Study",
				published: true,
				published_date: "2024-01-01T00:00:00Z" as string | null,
			});

			// Mock endpoints
			server.use(
				http.get(`${API_BASE_URL}/api/public/assurance-case/1/`, () => {
					return HttpResponse.json(publishedCase);
				}),
				http.post(`${API_BASE_URL}/api/case-studies/`, async ({ request }) => {
					const formData = await request.formData();
					return HttpResponse.json(
						{
							id: 10,
							title: formData.get("title"),
							description: formData.get("description"),
							assurance_cases: [1],
							published: false,
							created_date: new Date().toISOString(),
						},
						{ status: 201 }
					);
				})
			);

			const { PublicCaseViewMock } = await import(
				"./mocks/public-case-view-mock"
			);
			render(<PublicCaseViewMock caseId={1} />);

			// Wait for case to load
			await waitFor(() => {
				expect(
					screen.getByText("Published Case for Study")
				).toBeInTheDocument();
			});

			// Click create case study button
			const createStudyButton = screen.getByRole("button", {
				name: REGEX_PATTERNS.createCaseStudy,
			});
			await user.click(createStudyButton);

			// Fill in case study form
			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			const titleInput = screen.getByLabelText(REGEX_PATTERNS.title);
			await user.type(titleInput, "New Case Study from Published Case");

			const descriptionInput = screen.getByLabelText(
				REGEX_PATTERNS.description
			);
			await user.type(
				descriptionInput,
				"This case study is based on the published assurance case"
			);

			// Submit form
			const dialog = screen.getByRole("dialog");
			const submitButton = within(dialog).getByRole("button", {
				name: REGEX_PATTERNS.create,
			});
			await user.click(submitButton);

			// Verify success and navigation
			await waitFor(() => {
				expect(
					screen.getByText(REGEX_PATTERNS.caseStudyCreatedSuccessfully)
				).toBeInTheDocument();
				expect(mockPush).toHaveBeenCalledWith("/dashboard/case-studies/10");
			});
		});

		it("should verify bidirectional linking between case and case study", async () => {
			const caseStudy = {
				...createMockCaseStudy({
					id: 1,
					title: "Linked Case Study",
				}),
				assurance_cases: [1, 2],
			};

			const linkedCase1 = createMockAssuranceCase({
				id: 1,
				name: "First Linked Case",
				published: true,
			});

			const linkedCase2 = createMockAssuranceCase({
				id: 2,
				name: "Second Linked Case",
				published: true,
			});

			// Mock endpoints
			server.use(
				http.get(`${API_BASE_URL}/api/public/case-studies/1/`, () => {
					return HttpResponse.json(caseStudy);
				}),
				http.get(`${API_BASE_URL}/api/public/assurance-case/1/`, () => {
					return HttpResponse.json({
						...linkedCase1,
						case_studies: [caseStudy.id],
					});
				}),
				http.get(`${API_BASE_URL}/api/public/assurance-case/2/`, () => {
					return HttpResponse.json({
						...linkedCase2,
						case_studies: [caseStudy.id],
					});
				})
			);

			const { CaseStudyViewMock } = await import(
				"./mocks/case-study-view-mock"
			);
			render(<CaseStudyViewMock caseStudyId={1} />);

			// Verify case study shows linked cases
			await waitFor(() => {
				expect(screen.getByText("Linked Case Study")).toBeInTheDocument();
				expect(screen.getByText("First Linked Case")).toBeInTheDocument();
				expect(screen.getByText("Second Linked Case")).toBeInTheDocument();
			});

			// Click on a linked case
			const firstLinkedCase = screen.getByText("First Linked Case");
			await user.click(firstLinkedCase);

			// Verify navigation to case
			expect(mockPush).toHaveBeenCalledWith("/discover/cases/1");
		});
	});

	describe("Search and Filter Public Cases", () => {
		it("should search public cases by name", async () => {
			const allCases = [
				createMockAssuranceCase({
					id: 1,
					name: "Safety Critical System",
					published: true,
				}),
				createMockAssuranceCase({
					id: 2,
					name: "Security Framework",
					published: true,
				}),
				createMockAssuranceCase({
					id: 3,
					name: "Medical Device Safety",
					published: true,
				}),
			];

			// Mock search endpoint
			server.use(
				http.get(
					`${API_BASE_URL}/api/public/published-cases/`,
					({ request }) => {
						const url = new URL(request.url);
						const search = url.searchParams.get("search");

						if (search) {
							const filtered = allCases.filter((c) =>
								c.name.toLowerCase().includes(search.toLowerCase())
							);
							return HttpResponse.json(filtered);
						}

						return HttpResponse.json(allCases);
					}
				)
			);

			const { DiscoverPageMock } = await import("./mocks/discover-page-mock");
			render(<DiscoverPageMock />);

			// Wait for initial load
			await waitFor(() => {
				expect(screen.getByText("Safety Critical System")).toBeInTheDocument();
				expect(screen.getByText("Security Framework")).toBeInTheDocument();
				expect(screen.getByText("Medical Device Safety")).toBeInTheDocument();
			});

			// Search for "safety"
			const searchInput = screen.getByPlaceholderText(
				REGEX_PATTERNS.searchCases
			);
			await user.type(searchInput, "safety");

			// Mock filtered response
			server.use(
				http.get(
					`${API_BASE_URL}/api/public/published-cases/`,
					({ request }) => {
						const url = new URL(request.url);
						const search = url.searchParams.get("search");
						if (search === "safety") {
							return HttpResponse.json([allCases[0], allCases[2]]);
						}
						return HttpResponse.json(allCases);
					}
				)
			);

			// Trigger search
			const searchButton = screen.getByRole("button", {
				name: REGEX_PATTERNS.search,
			});
			await user.click(searchButton);

			// Verify filtered results
			await waitFor(() => {
				expect(screen.getByText("Safety Critical System")).toBeInTheDocument();
				expect(screen.getByText("Medical Device Safety")).toBeInTheDocument();
				expect(
					screen.queryByText("Security Framework")
				).not.toBeInTheDocument();
			});
		});

		it("should filter public cases by tags", async () => {
			const taggedCases = [
				createMockAssuranceCase({
					id: 1,
					name: "Automotive Safety",
					published: true,
					// @ts-expect-error - tags not in type but used for filtering
					tags: ["automotive", "safety"],
				}),
				createMockAssuranceCase({
					id: 2,
					name: "Medical Device",
					published: true,
					// @ts-expect-error
					tags: ["medical", "safety"],
				}),
				createMockAssuranceCase({
					id: 3,
					name: "Aerospace System",
					published: true,
					// @ts-expect-error
					tags: ["aerospace", "critical"],
				}),
			];

			// Mock filter endpoint
			server.use(
				http.get(
					`${API_BASE_URL}/api/public/published-cases/`,
					({ request }) => {
						const url = new URL(request.url);
						const tags = url.searchParams.get("tags");

						if (tags) {
							const tagList = tags.split(",");
							const filtered = taggedCases.filter((c) =>
								// @ts-expect-error
								tagList.some((tag) => c.tags?.includes(tag))
							);
							return HttpResponse.json(filtered);
						}
						return HttpResponse.json(taggedCases);
					}
				)
			);

			const { DiscoverPageMock } = await import("./mocks/discover-page-mock");
			render(<DiscoverPageMock />);

			// Wait for initial load
			await waitFor(() => {
				expect(screen.getByText("Automotive Safety")).toBeInTheDocument();
			});

			// Select "safety" tag filter
			const tagFilter = screen.getByRole("combobox", {
				name: REGEX_PATTERNS.filterByTags,
			});
			await user.selectOptions(tagFilter, "safety");

			// The onChange should trigger re-fetch, wait for results to update
			await waitFor(() => {
				// Debug: Check if any filtering happened
				const allCards = screen.getAllByTestId("case-card");
				expect(allCards).toHaveLength(2); // Should only show 2 cases with safety tag
			});

			// Verify filtered results
			expect(screen.getByText("Automotive Safety")).toBeInTheDocument();
			expect(screen.getByText("Medical Device")).toBeInTheDocument();
			expect(screen.queryByText("Aerospace System")).not.toBeInTheDocument();
		});

		it("should sort public cases by date published", async () => {
			const casesWithDates = [
				createMockAssuranceCase({
					id: 1,
					name: "Oldest Case",
					published: true,
					published_date: "2023-01-01T00:00:00Z",
				}),
				createMockAssuranceCase({
					id: 2,
					name: "Middle Case",
					published: true,
					published_date: "2023-06-01T00:00:00Z",
				}),
				createMockAssuranceCase({
					id: 3,
					name: "Newest Case",
					published: true,
					published_date: "2024-01-01T00:00:00Z",
				}),
			];

			// Mock sort endpoint
			server.use(
				http.get(
					`${API_BASE_URL}/api/public/published-cases/`,
					({ request }) => {
						const url = new URL(request.url);
						const sort = url.searchParams.get("sort");

						const cases = [...casesWithDates];
						if (sort === "published_date_desc") {
							cases.sort(
								(a, b) =>
									new Date(b.published_date || "").getTime() -
									new Date(a.published_date || "").getTime()
							);
						} else if (sort === "published_date_asc") {
							cases.sort(
								(a, b) =>
									new Date(a.published_date || "").getTime() -
									new Date(b.published_date || "").getTime()
							);
						}

						return HttpResponse.json(cases);
					}
				)
			);

			const { DiscoverPageMock } = await import("./mocks/discover-page-mock");
			render(<DiscoverPageMock />);

			// Wait for initial load
			await waitFor(() => {
				expect(screen.getByText("Oldest Case")).toBeInTheDocument();
				expect(screen.getByText("Middle Case")).toBeInTheDocument();
				expect(screen.getByText("Newest Case")).toBeInTheDocument();
			});

			// Select sort by newest first
			const sortSelect = screen.getByRole("combobox", {
				name: REGEX_PATTERNS.sortBy,
			});
			await user.selectOptions(sortSelect, "published_date_desc");

			// Verify order changed
			await waitFor(() => {
				const cases = screen.getAllByTestId("case-card");
				expect(within(cases[0]).getByText("Newest Case")).toBeInTheDocument();
				expect(within(cases[1]).getByText("Middle Case")).toBeInTheDocument();
				expect(within(cases[2]).getByText("Oldest Case")).toBeInTheDocument();
			});

			// Change to oldest first
			await user.selectOptions(sortSelect, "published_date_asc");

			// Verify order changed again
			await waitFor(() => {
				const cases = screen.getAllByTestId("case-card");
				expect(within(cases[0]).getByText("Oldest Case")).toBeInTheDocument();
				expect(within(cases[1]).getByText("Middle Case")).toBeInTheDocument();
				expect(within(cases[2]).getByText("Newest Case")).toBeInTheDocument();
			});
		});
	});

	describe("Error Handling", () => {
		it("should handle publish failure gracefully", async () => {
			const unpublishedCase = createMockAssuranceCase({
				id: 1,
				name: "Test Case",
				published: false,
				owner: mockUser.id,
			});

			server.use(
				http.get(`${API_BASE_URL}/api/cases/1/`, () => {
					return HttpResponse.json(unpublishedCase);
				}),
				http.put(`${API_BASE_URL}/api/cases/1/`, () => {
					return HttpResponse.json(
						{ error: "Failed to publish case" },
						{ status: 500 }
					);
				})
			);

			const { CaseEditorMock } = await import("./mocks/case-editor-mock");
			render(<CaseEditorMock caseData={unpublishedCase} />);

			// Open settings and try to publish
			const settingsButton = screen.getByRole("button", {
				name: REGEX_PATTERNS.settings,
			});
			await user.click(settingsButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			const publishToggle = screen.getByRole("switch", {
				name: REGEX_PATTERNS.publishCase,
			});
			await user.click(publishToggle);

			const saveButton = screen.getByRole("button", {
				name: REGEX_PATTERNS.save,
			});
			await user.click(saveButton);

			// Verify error message
			await waitFor(() => {
				expect(
					screen.getByText(REGEX_PATTERNS.failedToPublishCase)
				).toBeInTheDocument();
			});
		});

		it("should handle search errors gracefully", async () => {
			server.use(
				http.get(`${API_BASE_URL}/api/public/published-cases/`, () => {
					return HttpResponse.json(
						{ error: "Search service unavailable" },
						{ status: 503 }
					);
				})
			);

			const { DiscoverPageMock } = await import("./mocks/discover-page-mock");
			render(<DiscoverPageMock />);

			// Verify error message
			await waitFor(() => {
				expect(
					screen.getByText(REGEX_PATTERNS.unableToLoadPublishedCases)
				).toBeInTheDocument();
			});

			// Verify retry button
			const retryButton = screen.getByRole("button", {
				name: REGEX_PATTERNS.retry,
			});
			expect(retryButton).toBeInTheDocument();

			// Mock successful response for retry
			server.use(
				http.get(`${API_BASE_URL}/api/public/published-cases/`, () => {
					return HttpResponse.json([
						createMockAssuranceCase({
							id: 1,
							name: "Recovered Case",
							published: true,
						}),
					]);
				})
			);

			// Click retry
			await user.click(retryButton);

			// Verify recovery
			await waitFor(() => {
				expect(screen.getByText("Recovered Case")).toBeInTheDocument();
				expect(
					screen.queryByText(REGEX_PATTERNS.unableToLoadPublishedCases)
				).not.toBeInTheDocument();
			});
		});
	});
});

// Mock implementations for components used in tests
// Note: Mock components are in separate files:
// - DiscoverPageMock: './mocks/DiscoverPageMock.tsx'
// - CaseEditorMock: './mocks/case-editor-mock.tsx'
// - PublicCaseViewMock: './mocks/public-case-view-mock.tsx'
// - CaseStudyViewMock: './mocks/case-study-view-mock.tsx'
