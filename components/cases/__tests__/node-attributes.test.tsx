import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import type { Node } from "reactflow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordUpdate } from "@/lib/services/history-service";
import { toast } from "@/lib/toast";
import { server } from "@/src/__tests__/mocks/server";
import { renderWithAuth, screen } from "@/src/__tests__/utils/test-utils";
import useStore from "@/store/store";
import NodeAttributes from "../node-attributes";

vi.mock("@/lib/services/history-service", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/services/history-service")>();
	return { ...actual, recordUpdate: vi.fn() };
});

vi.mock("@/lib/toast", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/toast")>();
	return { ...actual, toast: vi.fn() };
});

const NODE = {
	id: "1",
	type: "goal",
	position: { x: 0, y: 0 },
	data: {
		id: 1,
		assumption: "",
		justification: "",
		context: [],
	},
} as unknown as Node & {
	data: {
		assumption?: string;
		context?: string[];
		id: number;
		justification?: string;
	};
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
	});
}

describe("NodeAttributes — save failure handling", () => {
	beforeEach(() => {
		resetStore();
		vi.mocked(toast).mockClear();
		vi.mocked(recordUpdate).mockClear();
	});

	it("surfaces the server error, keeps the dialog open, and records no undo entry on failure", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		server.use(
			http.put("/api/elements/1", () =>
				HttpResponse.json({ error: "Assumption is too long" }, { status: 400 })
			)
		);

		renderWithAuth(
			<NodeAttributes
				actions={{ setAction: vi.fn(), setSelectedLink: vi.fn() }}
				node={NODE}
				onClose={onClose}
				setUnresolvedChanges={vi.fn()}
			/>
		);

		await user.click(screen.getByRole("button", { name: "Update Attributes" }));

		await waitFor(() =>
			expect(toast).toHaveBeenCalledWith(
				expect.objectContaining({
					variant: "destructive",
					description: "Assumption is too long",
				})
			)
		);
		expect(recordUpdate).not.toHaveBeenCalled();
		expect(onClose).not.toHaveBeenCalled();
	});

	it("records the undo entry on a successful save", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		server.use(
			http.put("/api/elements/1", () => HttpResponse.json({}, { status: 200 }))
		);

		renderWithAuth(
			<NodeAttributes
				actions={{ setAction: vi.fn(), setSelectedLink: vi.fn() }}
				node={NODE}
				onClose={onClose}
				setUnresolvedChanges={vi.fn()}
			/>
		);

		await user.click(screen.getByRole("button", { name: "Update Attributes" }));

		await waitFor(() => expect(recordUpdate).toHaveBeenCalledTimes(1));
		expect(toast).not.toHaveBeenCalled();
	});
});
