import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useStore from "@/store/store";
import JsonViewPanel from "../json-view-panel";

const ROOT_ID = "11111111-1111-4111-8111-111111111111";

function sampleExport() {
	return {
		version: "1.0" as const,
		exportedAt: "2026-09-14T10:00:00.000Z",
		case: { name: "Test Case", description: "A case" },
		tree: {
			id: ROOT_ID,
			type: "GOAL" as const,
			name: "G1",
			description: "Root goal",
			inSandbox: false,
			children: [],
		},
	};
}

vi.mock("@/actions/export-case", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/actions/export-case")>();
	return {
		...actual,
		exportCase: vi.fn(async () => ({ data: sampleExport() })),
	};
});

vi.mock("@/lib/case", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/case")>();
	return {
		...actual,
		fetchAndRefreshCase: vi.fn(async () => null),
	};
});

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

describe("JsonViewPanel — full-screen toggle", () => {
	beforeEach(() => {
		resetStore();
	});

	it("enters full screen via the toolbar button, and Esc exits without closing the panel", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<JsonViewPanel isOpen={true} onClose={onClose} />);

		const enterButton = await screen.findByRole("button", {
			name: "Enter full screen",
		});
		await user.click(enterButton);

		const exitButton = await screen.findByRole("button", {
			name: "Exit full screen",
		});
		expect(exitButton).toHaveAttribute("aria-pressed", "true");

		fireEvent.keyDown(document, { key: "Escape" });

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "Enter full screen" })
			).toHaveAttribute("aria-pressed", "false");
		});

		// The panel itself must still be open — Esc only left full screen.
		expect(onClose).not.toHaveBeenCalled();
		expect(
			screen.getByRole("button", { name: "Enter full screen" })
		).toHaveFocus();
	});

	it("Esc closes the panel as before when not in full screen", async () => {
		const onClose = vi.fn();
		render(<JsonViewPanel isOpen={true} onClose={onClose} />);

		await screen.findByRole("button", { name: "Enter full screen" });

		fireEvent.keyDown(document, { key: "Escape" });

		await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
	});
});
