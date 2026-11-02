import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import type { Node } from "reactflow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCaseInformation } from "@/hooks/use-case-information";
import { useStatusModal } from "@/hooks/use-status-modal";
import { toast } from "@/lib/toast";
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

const CASE_ID = "case-1";
const ONE_LEFT = /1 element still to fill in/;
const TWO_LEFT = /2 elements still to fill in/;
const ANY_LEFT = /still to fill in/;
const COMPLETE_INFORMATION = {
	description: "A worked example",
	authors: "Ada Lovelace",
	sector: "Healthcare",
	featureImageUrl: null,
};

function node(id: number, isPlaceholder: boolean): Node {
	return {
		id: String(id),
		type: "property",
		position: { x: 0, y: 0 },
		data: { id, name: `P${id}`, description: "", isPlaceholder },
	};
}

function openWith(
	nodes: Node[],
	kind: "CASE" | "PATTERN",
	status: "DRAFT" | "PUBLISHED" = "DRAFT"
): void {
	vi.mocked(useCaseInformation).mockReturnValue({
		forCaseId: CASE_ID,
		information: COMPLETE_INFORMATION,
		loading: false,
		saving: false,
		uploadingImage: false,
		save: vi.fn(),
		uploadFeatureImage: vi.fn(),
		removeFeatureImage: vi.fn(),
	});
	useStore.setState({
		assuranceCase: {
			id: CASE_ID,
			name: "Test",
			type: "assurance-case",
			permissions: "manage",
			createdDate: new Date().toISOString(),
			comments: [],
			published: status === "PUBLISHED",
			publishStatus: status,
			kind,
		},
		nodes,
	});
	useStatusModal.getState().onOpen({
		caseId: CASE_ID,
		status,
		publishedAt: status === "PUBLISHED" ? "2026-08-01T00:00:00.000Z" : null,
	});
}

beforeEach(() => {
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

afterEach(() => {
	server.resetHandlers();
	vi.clearAllMocks();
	useStatusModal.getState().onClose();
	useStore.setState({ nodes: [] });
});

describe("the publish dialog of a case with placeholders on the canvas", () => {
	it("says how many elements are still to fill in, and offers no Publish button", async () => {
		openWith([node(1, true), node(2, true), node(3, false)], "CASE");

		render(<StatusModalWrapper />);

		expect(await screen.findByText(TWO_LEFT)).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Publish" })
		).not.toBeInTheDocument();
	});

	it("uses the singular for one element", async () => {
		openWith([node(1, true)], "CASE");

		render(<StatusModalWrapper />);

		expect(await screen.findByText(ONE_LEFT)).toBeInTheDocument();
	});

	it("counts an element shown twice, such as shared evidence, once", async () => {
		openWith([node(7, true), node(7, true)], "CASE");

		render(<StatusModalWrapper />);

		expect(await screen.findByText(ONE_LEFT)).toBeInTheDocument();
	});

	it("offers Publish when no element on the canvas is a placeholder", async () => {
		openWith([node(1, false), node(2, false)], "CASE");

		render(<StatusModalWrapper />);

		expect(
			await screen.findByRole("button", { name: "Publish" })
		).toBeInTheDocument();
		expect(screen.queryByText(ANY_LEFT)).not.toBeInTheDocument();
	});

	it("does not hold back a pattern for its placeholders", async () => {
		openWith([node(1, true), node(2, true)], "PATTERN");

		render(<StatusModalWrapper />);

		expect(
			await screen.findByRole("button", { name: "Publish" })
		).toBeInTheDocument();
		expect(screen.queryByText(ANY_LEFT)).not.toBeInTheDocument();
	});

	it("shows the server's refusal when the canvas had not yet caught up with the stored case", async () => {
		server.use(
			http.post(`/api/cases/${CASE_ID}/publish`, () =>
				HttpResponse.json(
					{ error: "1 element still to fill in", code: "VALIDATION" },
					{ status: 400 }
				)
			)
		);
		openWith([node(1, false)], "CASE");
		const user = userEvent.setup();
		render(<StatusModalWrapper />);

		await user.click(await screen.findByRole("button", { name: "Publish" }));

		await waitFor(() =>
			expect(toast).toHaveBeenCalledWith(
				expect.objectContaining({
					variant: "destructive",
					description: "1 element still to fill in",
				})
			)
		);
		expect(useStore.getState().assuranceCase?.published).toBe(false);
	});
});

describe("the dialog of a published case that has changes and placeholders", () => {
	it("says how many are still to fill in, and offers no Update Published button", async () => {
		openWith([node(1, true), node(2, false)], "CASE", "PUBLISHED");

		render(<StatusModalWrapper />);

		expect(await screen.findByText(ONE_LEFT)).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Update Published" })
		).not.toBeInTheDocument();
	});

	it("still offers Unpublish", async () => {
		openWith([node(1, true)], "CASE", "PUBLISHED");

		render(<StatusModalWrapper />);

		expect(
			await screen.findByRole("button", { name: "Unpublish" })
		).toBeInTheDocument();
	});

	it("offers Update Published once the placeholders are gone", async () => {
		openWith([node(1, false)], "CASE", "PUBLISHED");

		render(<StatusModalWrapper />);

		expect(
			await screen.findByRole("button", { name: "Update Published" })
		).toBeInTheDocument();
	});
});
