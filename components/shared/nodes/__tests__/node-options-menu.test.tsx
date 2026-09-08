import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import type React from "react";
import type { Node } from "reactflow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordDelete, recordDetach } from "@/lib/services/history-service";
import { toast } from "@/lib/toast";
import { server } from "@/src/__tests__/mocks/server";
import { renderWithReactFlow, screen } from "@/src/__tests__/utils/test-utils";
import useStore from "@/store/store";
import NodeOptionsMenu from "../node-options-menu";

// The repo-wide reactflow mock (src/__tests__/setup/component-mocks.tsx)
// doesn't stub `useNodes`/`useEdges`, which this component (and the
// always-mounted MoveElementDialog it renders) calls directly. Provide a
// minimal local replacement — only what this render tree actually uses.
vi.mock("reactflow", () => ({
	ReactFlowProvider: ({ children }: { children: React.ReactNode }) => children,
	useNodes: () => [],
	useEdges: () => [],
}));

vi.mock("@/lib/services/history-service", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/services/history-service")>();
	return { ...actual, recordDelete: vi.fn(), recordDetach: vi.fn() };
});

vi.mock("@/lib/toast", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/toast")>();
	return { ...actual, toast: vi.fn() };
});

const NODE: Node = {
	id: "1",
	type: "strategy",
	position: { x: 0, y: 0 },
	data: {
		id: 1,
		type: "strategy",
		name: "S1",
		description: "Strategy under test",
	},
};

function resetStore(): void {
	useStore.setState({
		assuranceCase: {
			id: "case-1",
			name: "Test Case",
			type: "assurance-case",
			permissions: "manage",
			createdDate: new Date().toISOString(),
			comments: [],
		},
		orphanedElements: [],
	});
}

async function openDeleteConfirmation(
	user: ReturnType<typeof userEvent.setup>
) {
	const trigger = screen.getByRole("button");
	await user.click(trigger);
	await user.click(await screen.findByText("Delete"));
	await user.click(await screen.findByRole("button", { name: "Delete" }));
}

async function openDetachConfirmation(
	user: ReturnType<typeof userEvent.setup>
) {
	const trigger = screen.getByRole("button");
	await user.click(trigger);
	await user.click(await screen.findByText("Detach"));
	await user.click(await screen.findByRole("button", { name: "Detach" }));
}

describe("NodeOptionsMenu — delete failure handling", () => {
	beforeEach(() => {
		resetStore();
		vi.mocked(toast).mockClear();
		vi.mocked(recordDelete).mockClear();
	});

	it("surfaces the server error, keeps the delete-confirmation dialog open, and records no undo entry on failure", async () => {
		const user = userEvent.setup();
		server.use(
			http.delete("/api/elements/1", () =>
				HttpResponse.json(
					{ error: "Strategy has dependent claims" },
					{
						status: 400,
					}
				)
			)
		);

		renderWithReactFlow(<NodeOptionsMenu node={NODE} nodeType="strategy" />);

		await openDeleteConfirmation(user);

		await waitFor(() =>
			expect(toast).toHaveBeenCalledWith(
				expect.objectContaining({
					variant: "destructive",
					description: "Strategy has dependent claims",
				})
			)
		);
		expect(recordDelete).not.toHaveBeenCalled();
		expect(
			screen.getByRole("heading", { name: "Delete S1?" })
		).toBeInTheDocument();
	});

	it("records the undo entry on a successful delete", async () => {
		const user = userEvent.setup();
		server.use(
			http.delete("/api/elements/1", () =>
				HttpResponse.json({}, { status: 200 })
			)
		);

		renderWithReactFlow(<NodeOptionsMenu node={NODE} nodeType="strategy" />);

		await openDeleteConfirmation(user);

		await waitFor(() => expect(recordDelete).toHaveBeenCalledTimes(1));
		expect(toast).not.toHaveBeenCalled();
	});
});

describe("NodeOptionsMenu — detach failure handling", () => {
	beforeEach(() => {
		resetStore();
		vi.mocked(toast).mockClear();
		vi.mocked(recordDetach).mockClear();
	});

	it("surfaces the server error, keeps the detach-confirmation dialog open, and records no undo entry on failure", async () => {
		const user = userEvent.setup();
		server.use(
			http.post("/api/elements/1/detach", () =>
				HttpResponse.json(
					{ error: "Strategy has dependent claims" },
					{
						status: 400,
					}
				)
			)
		);

		renderWithReactFlow(<NodeOptionsMenu node={NODE} nodeType="strategy" />);

		await openDetachConfirmation(user);

		await waitFor(() =>
			expect(toast).toHaveBeenCalledWith(
				expect.objectContaining({
					variant: "destructive",
					description: "Strategy has dependent claims",
				})
			)
		);
		expect(recordDetach).not.toHaveBeenCalled();
		expect(
			screen.getByRole("heading", { name: "Detach S1?" })
		).toBeInTheDocument();
	});
});
