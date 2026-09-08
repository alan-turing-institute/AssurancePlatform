import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCaseInformation } from "@/hooks/use-case-information";
import { useStatusModal } from "@/hooks/use-status-modal";
import { server } from "@/src/__tests__/mocks/server";
import useStore from "@/store/store";
import { StatusModalWrapper } from "../status-modal-wrapper";

vi.mock("@/hooks/use-case-information", () => ({
	useCaseInformation: vi.fn(),
}));

vi.mock("@/lib/toast", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/toast")>();
	return { ...actual, toast: vi.fn() };
});

const mockedUseCaseInformation = vi.mocked(useCaseInformation);
const CASE_ID = "case-1";

function stubCaseInformation(
	overrides: Partial<ReturnType<typeof useCaseInformation>>
) {
	mockedUseCaseInformation.mockReturnValue({
		forCaseId: CASE_ID,
		information: null,
		loading: false,
		saving: false,
		uploadingImage: false,
		save: vi.fn(),
		uploadFeatureImage: vi.fn(),
		removeFeatureImage: vi.fn(),
		...overrides,
	});
}

function resetStores(): void {
	useStore.setState({
		assuranceCase: {
			id: CASE_ID,
			name: "Test Case",
			type: "assurance-case",
			permissions: "manage",
			createdDate: new Date().toISOString(),
			comments: [],
			published: false,
			publishStatus: "DRAFT",
		},
		caseDetailsOpen: false,
		caseInformationFocusField: null,
	});
	useStatusModal.getState().onClose();
}

afterEach(() => {
	server.resetHandlers();
	vi.clearAllMocks();
});

describe("StatusModalWrapper — Draft: the guided Publish action", () => {
	beforeEach(() => {
		resetStores();
	});

	it("publishes via POST /api/cases/[id]/publish and updates the store on success", async () => {
		stubCaseInformation({
			information: {
				description: "A worked example",
				authors: "Ada Lovelace",
				sector: "Healthcare",
				featureImageUrl: null,
			},
		});

		let publishRequests = 0;
		server.use(
			http.post(`/api/cases/${CASE_ID}/publish`, () => {
				publishRequests += 1;
				return HttpResponse.json({
					published_id: "pub-1",
					published_at: "2026-08-11T00:00:00.000Z",
				});
			})
		);

		useStatusModal.getState().onOpen({
			caseId: CASE_ID,
			status: "DRAFT",
		});

		const user = userEvent.setup();
		render(<StatusModalWrapper />);

		await user.click(screen.getByRole("button", { name: "Publish" }));

		await waitFor(() => expect(publishRequests).toBe(1));
		await waitFor(() =>
			expect(useStore.getState().assuranceCase?.published).toBe(true)
		);
		expect(useStore.getState().assuranceCase?.publishStatus).toBe("PUBLISHED");
		// A single confirm closes the dialog on success.
		await waitFor(() => expect(useStatusModal.getState().isOpen).toBe(false));
	});

	it("does not publish, and instead routes to the case-information pane, when a required field is missing", async () => {
		stubCaseInformation({ information: null });

		useStatusModal.getState().onOpen({
			caseId: CASE_ID,
			status: "DRAFT",
		});

		const user = userEvent.setup();
		render(<StatusModalWrapper />);

		await user.click(
			screen.getByRole("button", { name: "Complete case information" })
		);

		expect(useStatusModal.getState().isOpen).toBe(false);
		expect(useStore.getState().caseDetailsOpen).toBe(true);
		expect(useStore.getState().caseInformationFocusField).toBe("description");
	});
});

describe("StatusModalWrapper — Published: unpublish", () => {
	beforeEach(() => {
		resetStores();
		stubCaseInformation({});
		// The wrapper's change-detection call fires whenever the modal is open
		// with status PUBLISHED — stub it to a stable "no changes" result so
		// these tests aren't coupled to that endpoint's behaviour.
		server.use(
			http.get(`/api/cases/${CASE_ID}/changes`, () =>
				HttpResponse.json({
					hasChanges: false,
					publishedAt: "2026-08-01T00:00:00.000Z",
					publishedId: "pub-1",
				})
			)
		);
	});

	it("unpublishes atomically via PATCH /api/cases/[id]/status after a plain-consequences confirm", async () => {
		let patchBody: unknown;
		server.use(
			http.patch(`/api/cases/${CASE_ID}/status`, async ({ request }) => {
				patchBody = await request.json();
				return HttpResponse.json({ success: true, newStatus: "DRAFT" });
			})
		);

		useStatusModal.getState().onOpen({
			caseId: CASE_ID,
			status: "PUBLISHED",
			publishedAt: "2026-08-01T00:00:00.000Z",
		});

		const user = userEvent.setup();
		render(<StatusModalWrapper />);

		await user.click(screen.getByRole("button", { name: "Unpublish" }));
		await user.click(screen.getByRole("button", { name: "Yes, unpublish" }));

		await waitFor(() =>
			expect(useStore.getState().assuranceCase?.published).toBe(false)
		);
		expect(patchBody).toMatchObject({ targetStatus: "DRAFT" });
		await waitFor(() => expect(useStatusModal.getState().isOpen).toBe(false));
	});
});

describe("StatusModalWrapper — Published: republish (Update Published)", () => {
	beforeEach(() => {
		resetStores();
		// Unpublished changes, so the divergence indicator and Update
		// Published action are on offer.
		server.use(
			http.get(`/api/cases/${CASE_ID}/changes`, () =>
				HttpResponse.json({
					hasChanges: true,
					publishedAt: "2026-08-01T00:00:00.000Z",
					publishedId: "pub-1",
				})
			)
		);
	});

	it("republishes via PATCH /api/cases/[id]/status PUBLISHED->PUBLISHED when case information is complete", async () => {
		stubCaseInformation({
			information: {
				description: "A worked example",
				authors: "Ada Lovelace",
				sector: "Healthcare",
				featureImageUrl: null,
			},
		});

		let patchBody: unknown;
		server.use(
			http.patch(`/api/cases/${CASE_ID}/status`, async ({ request }) => {
				patchBody = await request.json();
				return HttpResponse.json({
					success: true,
					newStatus: "PUBLISHED",
					publishedId: "pub-2",
					publishedAt: "2026-08-11T00:00:00.000Z",
				});
			})
		);

		useStatusModal.getState().onOpen({
			caseId: CASE_ID,
			status: "PUBLISHED",
			publishedAt: "2026-08-01T00:00:00.000Z",
		});

		const user = userEvent.setup();
		render(<StatusModalWrapper />);

		await user.click(
			await screen.findByRole("button", { name: "Update Published" })
		);

		await waitFor(() =>
			expect(patchBody).toMatchObject({
				targetStatus: "PUBLISHED",
			})
		);
		await waitFor(() => expect(useStatusModal.getState().isOpen).toBe(false));
	});

	it("does not republish, and instead routes to the case-information pane, when a required field is missing", async () => {
		stubCaseInformation({ information: null });

		let patchRequests = 0;
		server.use(
			http.patch(`/api/cases/${CASE_ID}/status`, () => {
				patchRequests += 1;
				return HttpResponse.json({ success: true, newStatus: "PUBLISHED" });
			})
		);

		useStatusModal.getState().onOpen({
			caseId: CASE_ID,
			status: "PUBLISHED",
			publishedAt: "2026-08-01T00:00:00.000Z",
		});

		const user = userEvent.setup();
		render(<StatusModalWrapper />);

		await user.click(
			await screen.findByRole("button", { name: "Complete case information" })
		);

		expect(patchRequests).toBe(0);
		expect(useStatusModal.getState().isOpen).toBe(false);
		expect(useStore.getState().caseDetailsOpen).toBe(true);
		expect(useStore.getState().caseInformationFocusField).toBe("description");
	});
});
