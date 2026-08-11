import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStatusModal } from "@/hooks/use-status-modal";
import useStore from "@/store/store";
import Header from "../header";

// Minimal local replacement for the two reactflow hooks Header calls
// directly (`useReactFlow` for `setCenter`, `useUpdateNodeInternals`) —
// unrelated to the click behaviour under test, same pattern as
// node-options-menu.test.tsx.
vi.mock("reactflow", () => ({
	useReactFlow: () => ({ setCenter: vi.fn() }),
	useUpdateNodeInternals: () => vi.fn(),
}));

// This header's own `useChangeDetection` call is unrelated to the click
// behaviour under test — stub it so no network activity is needed to prove
// the click handler doesn't gate on one.
vi.mock("@/hooks/use-change-detection", () => ({
	useChangeDetection: () => ({
		hasChanges: false,
		publishedAt: null,
		publishedId: null,
		changeSummary: null,
		isLoading: false,
		error: null,
		refresh: vi.fn(),
	}),
}));

function resetStore(published: boolean): void {
	useStore.setState({
		assuranceCase: {
			id: "case-1",
			name: "Test Case",
			type: "assurance-case",
			permissions: "manage",
			createdDate: new Date().toISOString(),
			comments: [],
			published,
			publishStatus: published ? "PUBLISHED" : "DRAFT",
			publishedAt: published ? "2026-08-01T00:00:00.000Z" : null,
			linkedCaseStudyCount: 0,
		},
	});
	useStatusModal.getState().onClose();
}

function renderHeader() {
	return render(<Header setOpen={vi.fn()} />);
}

describe("Header — status button opens the dialog immediately (no synchronous GET /status)", () => {
	let fetchSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		resetStore(false);
		fetchSpy = vi.spyOn(global, "fetch");
	});

	afterEach(() => {
		fetchSpy.mockRestore();
	});

	it("opens the status modal on click for a draft case without ever calling GET /status", async () => {
		const user = userEvent.setup();
		renderHeader();

		await user.click(screen.getByRole("button", { name: "Draft" }));

		expect(useStatusModal.getState().isOpen).toBe(true);
		expect(useStatusModal.getState().caseId).toBe("case-1");
		expect(useStatusModal.getState().status).toBe("DRAFT");

		const statusCalls = fetchSpy.mock.calls.filter((call: unknown[]) =>
			String(call[0]).includes("/status")
		);
		expect(statusCalls).toHaveLength(0);
	});

	it("opens the status modal on click for a published case, precomputed from already-known state, without calling GET /status", async () => {
		resetStore(true);
		const user = userEvent.setup();
		renderHeader();

		await user.click(screen.getByRole("button", { name: "Published" }));

		expect(useStatusModal.getState().isOpen).toBe(true);
		expect(useStatusModal.getState().status).toBe("PUBLISHED");
		expect(useStatusModal.getState().publishedAt).toBe(
			"2026-08-01T00:00:00.000Z"
		);

		const statusCalls = fetchSpy.mock.calls.filter((call: unknown[]) =>
			String(call[0]).includes("/status")
		);
		expect(statusCalls).toHaveLength(0);
	});

	it("does nothing for a user without edit permission", async () => {
		useStore.setState({
			assuranceCase: {
				id: "case-1",
				name: "Test Case",
				type: "assurance-case",
				permissions: "view",
				createdDate: new Date().toISOString(),
				comments: [],
				published: false,
				publishStatus: "DRAFT",
			},
		});
		const user = userEvent.setup();
		renderHeader();

		await user.click(screen.getByRole("button", { name: "Draft" }));

		expect(useStatusModal.getState().isOpen).toBe(false);
	});
});
