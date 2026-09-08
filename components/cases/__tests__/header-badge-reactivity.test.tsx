import { render, screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStatusModal } from "@/hooks/use-status-modal";
import { server } from "@/src/__tests__/mocks/server";
import useStore from "@/store/store";
import Header from "../header";

// Same local replacement as header.test.tsx — unrelated to change-detection
// reactivity, which is what this file covers.
vi.mock("reactflow", () => ({
	useReactFlow: () => ({ setCenter: vi.fn() }),
	useUpdateNodeInternals: () => vi.fn(),
}));

const CASE_ID = "case-1";
const CHANGES_PATH = `/api/cases/${CASE_ID}/changes`;

function publishedCase(overrides: Partial<{ published: boolean }> = {}) {
	return {
		id: CASE_ID,
		name: "Test Case",
		type: "assurance-case",
		permissions: "manage",
		createdDate: new Date().toISOString(),
		comments: [],
		published: true,
		publishStatus: "PUBLISHED" as const,
		publishedAt: "2026-08-01T00:00:00.000Z",
		...overrides,
	};
}

function changesResponse(hasChanges: boolean) {
	return HttpResponse.json({
		hasChanges,
		publishedAt: "2026-08-01T00:00:00.000Z",
		publishedId: "published-1",
	});
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("Header — canvas publish badge reacts live to structural edits (no reload)", () => {
	beforeEach(() => {
		useStore.setState({ assuranceCase: publishedCase() });
		useStatusModal.getState().onClose();
	});

	it("shows the 'Changes pending' dot once a structural edit replaces the store's assuranceCase, without remounting", async () => {
		let requestCount = 0;
		server.use(
			http.get(CHANGES_PATH, () => {
				requestCount += 1;
				// Behind the published version only from the second check
				// onward — i.e. only after the simulated structural edit below.
				return changesResponse(requestCount > 1);
			})
		);

		render(<Header setOpen={vi.fn()} />);

		await waitFor(() => expect(requestCount).toBe(1));
		expect(screen.queryByTitle("Changes pending")).not.toBeInTheDocument();

		// Simulate a structural edit landing (e.g. via node-attributes.tsx /
		// node-options-menu.tsx, both of which call setAssuranceCase with a
		// freshly spread object) — no fetch, no reload, just what a real
		// element create/update/delete does to the store.
		useStore.setState({
			assuranceCase: { ...useStore.getState().assuranceCase, name: "Edited" },
		} as Partial<ReturnType<typeof useStore.getState>>);

		await waitFor(() => expect(requestCount).toBe(2));
		await waitFor(() =>
			expect(screen.getByTitle("Changes pending")).toBeInTheDocument()
		);
	});

	it("does not re-fetch when only comment-related store state changes", async () => {
		let requestCount = 0;
		server.use(
			http.get(CHANGES_PATH, () => {
				requestCount += 1;
				return changesResponse(false);
			})
		);

		render(<Header setOpen={vi.fn()} />);

		await waitFor(() => expect(requestCount).toBe(1));

		// A comment mutation touches nodeComments/caseNotes only, never
		// assuranceCase — verifies the comment-immunity constraint at the
		// store-shape level (server-side exclusion is covered separately in
		// publish-journey.spec.ts).
		useStore.setState({
			nodeComments: [
				{
					id: "c1",
					content: "A comment",
					createdAt: new Date().toISOString(),
				},
			],
		} as Partial<ReturnType<typeof useStore.getState>>);

		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(requestCount).toBe(1);
	});
});
